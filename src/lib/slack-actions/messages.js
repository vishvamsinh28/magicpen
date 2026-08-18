import { Documents, Chats, Messages, Changes, Presence, SlackThreads } from "@/lib/store";
import { runAssistant, summarizeEdits } from "@/lib/gemini";
import { htmlToBlocks, applyOpsToHtml } from "@/lib/blocks-server";
import { cleanDocHtml } from "@/lib/sanitize";
import { say, section, context, unwrapSlackText, parseThreadCommand, aiErrorText } from "./format";
import { resolveUser, promptConnect } from "./identity";
import { deliverFile, commitDoc, undoDoc, sendDocFile, renameDoc, deleteDoc } from "./doc-ops";
import { handleUpload } from "./upload";

// The @mention / DM message handler — the bot's main entry point for
// conversational traffic.

// Short nudge shown when someone messages the bot outside a document thread.
function helpBlocks() {
  return [
    section("👋 I won't turn a plain message into a document. Use `/magicpen new <name>` to create one, or *reply inside a document's thread* to edit it."),
    context("Type `/magicpen help` to see everything I can do."),
  ];
}

const PRESENCE_ACTIVE_MS = 45_000;
// How many people have this document open in the web editor right now —
// used to warn that a Slack edit will appear under them.
async function activeEditorCount(documentId) {
  const rows = await Presence.list(documentId);
  const cutoff = Date.now() - PRESENCE_ACTIVE_MS;
  return rows.filter((r) => r.lastSeenAt && new Date(r.lastSeenAt).getTime() > cutoff).length;
}

/**
 * Handles an @mention or DM. Never creates from a plain message: only file
 * uploads and replies inside an existing document thread do anything —
 * everything else gets guidance. In-thread colon-token commands dispatch to
 * doc-ops; any other thread reply runs one AI turn, applies the edits, records
 * chat + change history, and re-delivers the file.
 */
export async function handleMessage({ teamId, channel, slackUserId, text, threadTs, files, botToken }) {
  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    await promptConnect({ botToken, channel, threadTs, teamId, slackUserId });
    return;
  }

  // A shared file → import it (explicit action, always allowed).
  if (files?.length) {
    await handleUpload({ user, teamId, channel, threadTs, botToken, file: files[0] });
    return;
  }

  const binding = await SlackThreads.get(teamId, channel, threadTs);

  // Not inside a document thread → guide to commands. Never auto-create.
  if (!binding?.documentId) {
    await say(botToken, { channel, threadTs, text: "Use `/magicpen new <name>` to create a document, or reply inside a document's thread to edit it.", blocks: helpBlocks() });
    return;
  }

  const doc = await Documents.get(binding.documentId, user.id);
  if (!doc) {
    await say(botToken, { channel, threadTs, text: "That document is no longer available." });
    return;
  }

  const prompt = unwrapSlackText(text);
  if (!prompt) {
    await say(botToken, { channel, threadTs, text: "Tell me what to change, or type an action: `:commit:` · `:undo:` · `:send:`." });
    return;
  }

  // In-thread meta commands.
  const cmd = parseThreadCommand(prompt);
  if (cmd.action === "commit") return commitDoc({ botToken, channel, threadTs, user, documentId: doc.id, label: cmd.arg });
  if (cmd.action === "undo") return undoDoc({ botToken, channel, threadTs, user, documentId: doc.id });
  if (cmd.action === "send") return sendDocFile({ botToken, channel, threadTs, user, documentId: doc.id, format: cmd.format });
  if (cmd.action === "rename") return renameDoc({ botToken, channel, threadTs, user, documentId: doc.id, name: cmd.arg });
  if (cmd.action === "delete") return deleteDoc({ botToken, channel, threadTs, user, documentId: doc.id, confirm: cmd.arg });

  // Otherwise: edit / answer via the assistant.
  const chatHistory = binding.chatId ? await Messages.list(binding.chatId) : [];
  let result;
  try {
    result = await runAssistant({
      message: prompt,
      blocks: htmlToBlocks(doc.contentHtml || ""),
      docTitle: doc.title,
      history: chatHistory,
      mode: "balanced",
    });
  } catch (err) {
    await say(botToken, { channel, threadTs, text: aiErrorText(err) });
    return;
  }

  const beforeHtml = doc.contentHtml || "";
  const afterHtml = result.edits.length ? cleanDocHtml(applyOpsToHtml(beforeHtml, result.edits)) : beforeHtml;
  const changed = afterHtml !== beforeHtml;

  let chat = binding.chatId ? await Chats.get(binding.chatId, user.id) : null;
  if (!chat) chat = await Chats.create({ userId: user.id, title: prompt.slice(0, 64), scope: "document", documentId: doc.id });

  if (changed) {
    const patch = { contentHtml: afterHtml };
    // Keep the user's chosen name — only auto-title a doc still left as default.
    const isDefaultTitle = !doc.title || /^untitled document$/i.test(doc.title.trim());
    if (result.title && isDefaultTitle) patch.title = result.title.slice(0, 200);
    await Documents.update(doc.id, user.id, patch);
    await Changes.add({
      userId: user.id, documentId: doc.id, chatId: chat.id,
      summary: summarizeEdits(result.edits) || "Edited from Slack",
      ops: result.edits, beforeHtml, afterHtml, status: "applied",
    });
  }

  await Messages.add({ chatId: chat.id, userId: user.id, role: "user", content: prompt });
  await Messages.add({
    chatId: chat.id, userId: user.id, role: "assistant", content: result.reply,
    edits: result.edits.length ? result.edits : null, editSummary: summarizeEdits(result.edits),
  });
  await SlackThreads.bind({ teamId, channelId: channel, threadTs, userId: user.id, documentId: doc.id, chatId: chat.id });

  if (changed) {
    const active = await activeEditorCount(doc.id);
    const updated = await Documents.get(doc.id, user.id);
    const note = active ? "\n⚠️ Someone has this doc open — they'll see the change after a refresh." : "";
    const comment =
      `${result.reply}\n_${summarizeEdits(result.edits)}_${note}\n` +
      "Actions: `:send:` (or `:send: md` / `html` / `txt`) for the file · `:commit:` to snapshot · `:undo:` to revert.";
    await deliverFile({ botToken, channel, threadTs, doc: updated, comment });
  } else {
    await say(botToken, { channel, threadTs, text: result.reply });
  }
}

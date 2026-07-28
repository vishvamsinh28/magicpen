import {
  Users, Documents, Chats, Messages, Versions, Changes, Presence,
  SlackInstalls, SlackLinks, SlackThreads,
} from "@/lib/store";
import { runAssistant, summarizeEdits } from "@/lib/gemini";
import { htmlToBlocks, applyOpsToHtml, isHtmlEmpty } from "@/lib/blocks-server";
import { cleanDocHtml, htmlToText } from "@/lib/sanitize";
import { parseFileToHtml, MAX_UPLOAD_BYTES, fileExtension, ACCEPTED_EXTENSIONS } from "@/lib/parse";
import { exportDoc, EXPORT_FORMATS } from "@/lib/export";
import {
  postMessage, uploadFileToSlack, downloadSlackFile, docUrl, connectUrl, signConnectState,
} from "@/lib/slack";

// The bot's brain. Interaction model:
//   • A plain message that isn't in a document thread never creates anything —
//     it replies with guidance to use commands.
//   • Documents are created only via `/superdoc new` (which posts a thread) or
//     by uploading a file.
//   • Everything about a specific document happens inside that document's
//     thread: reply to edit/ask, or type `commit` / `undo` / `send`.
//   • The actual file is delivered into Slack on create, on every edit, and on
//     `send`. No interactive buttons — commands + threads only.

/* --------------------------- identity & tokens ---------------------------- */

// Prefers the per-workspace token from the OAuth install; falls back to a
// single SLACK_BOT_TOKEN env var (handy for a dev/single workspace).
export const botTokenForTeam = async (teamId) =>
  (await SlackInstalls.getByTeam(teamId))?.botToken || process.env.SLACK_BOT_TOKEN || null;

export async function resolveUser(teamId, slackUserId) {
  const link = await SlackLinks.get(teamId, slackUserId);
  if (!link?.userId) return null;
  return Users.get(link.userId);
}

/* ------------------------------ text helpers ------------------------------ */

function unwrapSlackText(text = "") {
  return String(text)
    .replace(/<@[^>]+>/g, "")
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTitle(html) {
  const text = htmlToText(html).split("\n").find((l) => l.trim());
  return (text || "Untitled document").trim().slice(0, 80);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

function aiErrorText(err) {
  if (err.code === "ai_not_configured") return "The AI isn't configured on the server yet (missing GEMINI_API_KEY).";
  if (err.code === "ai_quota") return err.message;
  return "The AI request failed — please try again.";
}

// In-thread meta commands vs. an edit/question.
function parseThreadCommand(text) {
  const m = text.trim();
  if (/^commit\b/i.test(m)) return { action: "commit", arg: m.replace(/^commit(\s+version)?\s*/i, "").trim() };
  if (/^undo\b/i.test(m)) return { action: "undo" };
  if (/^(send|export|download)\b/i.test(m)) {
    const raw = (m.match(/\b(docx|md|markdown|txt|text|html)\b/i) || [])[1];
    const format = raw ? ({ markdown: "md", text: "txt" }[raw.toLowerCase()] || raw.toLowerCase()) : "docx";
    return { action: "send", format };
  }
  return { action: "edit" };
}

const PRESENCE_ACTIVE_MS = 45_000;
async function activeEditorCount(documentId) {
  const rows = await Presence.list(documentId);
  const cutoff = Date.now() - PRESENCE_ACTIVE_MS;
  return rows.filter((r) => r.lastSeenAt && new Date(r.lastSeenAt).getTime() > cutoff).length;
}

/* ------------------------------ block helpers ----------------------------- */

const section = (text) => ({ type: "section", text: { type: "mrkdwn", text } });
const context = (text) => ({ type: "context", elements: [{ type: "mrkdwn", text }] });
// Plain hyperlink (no button element) so nothing depends on Interactivity.
const openLink = (documentId) => `<${docUrl(documentId)}|Open in SuperDocs>`;

const say = (botToken, { channel, threadTs, text, blocks }) =>
  postMessage(botToken, { channel, thread_ts: threadTs, text, blocks, unfurl_links: false });

async function postToResponseUrl(url, payload) {
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function connectPayload(url) {
  return {
    text: "Connect your SuperDocs account to continue.",
    blocks: [
      section("👋 *Connect your SuperDocs account* to let me create, edit, and manage your documents from Slack."),
      section(`<${url}|Connect SuperDocs →>`),
      context("You only do this once. It links your Slack identity to your SuperDocs account."),
    ],
  };
}

export async function promptConnect({ botToken, channel, threadTs, teamId, slackUserId }) {
  const state = await signConnectState({ teamId, slackUserId });
  await say(botToken, { channel, threadTs, ...connectPayload(connectUrl(state)) });
}

function helpBlocks() {
  return [
    section("👋 I work through *commands* and *threads* — I won't turn a plain message into a document."),
    section(
      "*Create* → `/superdoc new <what you want>`\n" +
      "*Your documents* → `/superdoc list`\n" +
      "*Open one* → `/superdoc open <title>`\n" +
      "*Import a file* → just drag it into this chat\n\n" +
      "Once a document exists, *reply inside its thread* to edit it — and type *commit*, *undo*, or *send* right in that thread."
    ),
  ];
}

/* ----------------------------- file delivery ------------------------------ */

// Exports the document and uploads it into the thread. `comment` becomes the
// message that carries the file. Falls back to a text message + link if the
// upload fails (e.g. missing files:write scope) so the user isn't left blank.
async function deliverFile({ botToken, channel, threadTs, doc, format = "docx", comment }) {
  const fmt = EXPORT_FORMATS.includes(format) ? format : "docx";
  const html = doc.contentHtml || "";
  if (isHtmlEmpty(html)) {
    await say(botToken, { channel, threadTs, text: comment || `*${doc.title}* is empty.` });
    return;
  }
  try {
    const { body, filename } = await exportDoc({ html, title: doc.title, format: fmt });
    await uploadFileToSlack(botToken, { channel, threadTs, filename, buffer: body, title: doc.title, comment });
  } catch (err) {
    console.error("[superdocs/slack] file delivery failed:", err);
    const scopeHint = err.code === "missing_scope" ? " (the bot needs the *files:write* scope — add it and reinstall)" : "";
    await say(botToken, {
      channel, threadTs,
      text: `${comment ? comment + "\n" : ""}Couldn't attach the file${scopeHint}. ${openLink(doc.id)}`,
    });
  }
}

/* ------------------------------ doc operations ---------------------------- */

async function commitDoc({ botToken, channel, threadTs, user, documentId, label }) {
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  const count = (await Versions.list(documentId, user.id)).length;
  const finalLabel = (label && label.trim()) || `From Slack · ${stamp()}`;
  await Versions.add({ userId: user.id, documentId, label: finalLabel.slice(0, 120), contentHtml: doc.contentHtml || "" });
  await say(botToken, { channel, threadTs, text: `💾 Committed version ${count + 1} of *${doc.title}* — _${finalLabel}_.` });
}

async function undoDoc({ botToken, channel, threadTs, user, documentId }) {
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  const last = (await Changes.list(documentId, user.id)).find((c) => c.status === "applied");
  if (!last) { await say(botToken, { channel, threadTs, text: "There's nothing to undo on this document." }); return; }
  await Documents.update(documentId, user.id, { contentHtml: last.beforeHtml || "" });
  await Changes.add({
    userId: user.id, documentId, summary: "Reverted last change (Slack)",
    ops: [], beforeHtml: doc.contentHtml || "", afterHtml: last.beforeHtml || "", status: "restored",
  });
  const updated = await Documents.get(documentId, user.id);
  await deliverFile({ botToken, channel, threadTs, doc: updated, comment: `↩ Reverted the last change to *${doc.title}*.` });
}

async function sendDocFile({ botToken, channel, threadTs, user, documentId, format }) {
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  await deliverFile({ botToken, channel, threadTs, doc, format, comment: `📎 *${doc.title}*` });
}

/* -------------------------------- upload ---------------------------------- */

async function handleUpload({ user, teamId, channel, threadTs, botToken, file }) {
  const ext = fileExtension(file.name || file.title || "");
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    await say(botToken, { channel, threadTs, text: `I can't read *.${ext || "?"}* files. Try PDF, DOCX, TXT, RTF, MD, or HTML.` });
    return;
  }
  if (file.size && file.size > MAX_UPLOAD_BYTES) {
    await say(botToken, { channel, threadTs, text: "That file is larger than 30 MB." });
    return;
  }

  let parsed;
  try {
    const buffer = await downloadSlackFile(file.url_private_download || file.url_private, botToken);
    parsed = await parseFileToHtml({ buffer, filename: file.name || `upload.${ext}` });
  } catch (err) {
    console.error("[superdocs/slack] upload parse failed:", err);
    await say(botToken, { channel, threadTs, text: `Couldn't read "${file.name}". It may be corrupted or password-protected.` });
    return;
  }

  if (isHtmlEmpty(parsed.html)) {
    await say(botToken, { channel, threadTs, text: "I couldn't extract any content from that file." });
    return;
  }

  const doc = await Documents.create({
    userId: user.id,
    title: parsed.title,
    contentHtml: parsed.html,
    sourceFile: { name: file.name, type: file.mimetype || null, size: file.size || null },
  });
  await SlackThreads.bind({ teamId, channelId: channel, threadTs, userId: user.id, documentId: doc.id, chatId: null });

  await say(botToken, {
    channel, threadTs,
    text: `Imported *${parsed.title}*.`,
    blocks: [
      section(`📄 Imported *${parsed.title}* into SuperDocs.${parsed.notice ? `\n_${parsed.notice}_` : ""}`),
      context('Reply in this thread to edit it — e.g. _"summarize the key points at the top"_. Type *send* for the file, *commit* to snapshot.'),
      section(openLink(doc.id)),
    ],
  });
}

/* --------------------------- main message handler ------------------------- */

// @mention or DM. Never creates from a plain message: only file uploads and
// replies inside an existing document thread do anything.
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
    await say(botToken, { channel, threadTs, text: "Use `/superdoc new <prompt>` to create a document, or reply inside a document's thread to edit it.", blocks: helpBlocks() });
    return;
  }

  const doc = await Documents.get(binding.documentId, user.id);
  if (!doc) {
    await say(botToken, { channel, threadTs, text: "That document is no longer available." });
    return;
  }

  const prompt = unwrapSlackText(text);
  if (!prompt) {
    await say(botToken, { channel, threadTs, text: "Tell me what to change, or type *commit*, *undo*, or *send*." });
    return;
  }

  // In-thread meta commands.
  const cmd = parseThreadCommand(prompt);
  if (cmd.action === "commit") return commitDoc({ botToken, channel, threadTs, user, documentId: doc.id, label: cmd.arg });
  if (cmd.action === "undo") return undoDoc({ botToken, channel, threadTs, user, documentId: doc.id });
  if (cmd.action === "send") return sendDocFile({ botToken, channel, threadTs, user, documentId: doc.id, format: cmd.format });

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
    if (result.title) patch.title = result.title.slice(0, 200);
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
      "Type *commit* to snapshot · *undo* to revert · *send md* for another format.";
    await deliverFile({ botToken, channel, threadTs, doc: updated, comment });
  } else {
    await say(botToken, { channel, threadTs, text: result.reply });
  }
}

/* ------------------------- slash: create (/superdoc new) ------------------ */

// Runs in the background (AI is slow); posts a real message as the thread root,
// binds the thread to the new document, and delivers the file. Replies to the
// slash command privately via response_url.
export async function createDocFromSlash({ teamId, channel, slackUserId, prompt, botToken, responseUrl }) {
  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", ...connectPayload(connectUrl(state)) });
    return;
  }
  if (!prompt.trim()) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: "Usage: `/superdoc new <what you want>`" });
    return;
  }

  let result;
  try {
    result = await runAssistant({ message: prompt, blocks: [], docTitle: "", history: [], mode: "balanced" });
  } catch (err) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: aiErrorText(err) });
    return;
  }

  const html = cleanDocHtml(applyOpsToHtml("", result.edits));
  if (isHtmlEmpty(html)) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: result.reply });
    return;
  }

  const title = (result.title || deriveTitle(html)).slice(0, 200);
  const doc = await Documents.create({ userId: user.id, title, contentHtml: html });
  const chat = await Chats.create({ userId: user.id, title: prompt.slice(0, 64), scope: "document", documentId: doc.id });
  await Messages.add({ chatId: chat.id, userId: user.id, role: "user", content: prompt });
  await Messages.add({
    chatId: chat.id, userId: user.id, role: "assistant", content: result.reply,
    edits: result.edits.length ? result.edits : null, editSummary: summarizeEdits(result.edits),
  });

  // Post the document card as the thread root, then bind the thread.
  let rootTs = null;
  try {
    const posted = await postMessage(botToken, {
      channel,
      text: `📄 Created *${title}*`,
      blocks: [
        section(`📄 Created *${title}*\n${result.reply}`),
        context('Reply in this thread to edit — e.g. _"add a risks section"_. Type *commit* · *undo* · *send docx|md|txt* right here.'),
        section(openLink(doc.id)),
      ],
      unfurl_links: false,
    });
    rootTs = posted.ts;
    await SlackThreads.bind({ teamId, channelId: channel, threadTs: rootTs, userId: user.id, documentId: doc.id, chatId: chat.id });
    await deliverFile({ botToken, channel, threadTs: rootTs, doc, comment: `📎 Here's *${title}*.` });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `✅ Created *${title}* — see the thread I posted.` });
  } catch (err) {
    console.error("[superdocs/slack] create post failed:", err);
    await postToResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `✅ Created *${title}*, but I couldn't post it here (${err.code || "error"}). ${openLink(doc.id)}`,
    });
  }
}

/* ------------------------ slash: fast commands ---------------------------- */

// `/superdoc <sub>` for list / open / commit / help. Returns a payload the route
// sends as an ephemeral reply. (`new` is handled by createDocFromSlash.)
export async function handleSlashCommand({ teamId, slackUserId, text }) {
  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    return connectPayload(connectUrl(state));
  }

  const [sub, ...rest] = String(text || "").trim().split(/\s+/);
  const arg = rest.join(" ").trim();

  if (!sub || sub === "help") {
    return {
      text: "SuperDocs commands",
      blocks: [section(
        "*SuperDocs commands*\n" +
        "• `/superdoc new <prompt>` — draft a new document (I'll post it as a thread)\n" +
        "• `/superdoc list` — your recent documents\n" +
        "• `/superdoc open <title>` — open a document\n" +
        "• `/superdoc commit [label]` — snapshot your most recent document\n\n" +
        "Then *reply in a document's thread* to edit it, or type *commit* / *undo* / *send* there."
      )],
    };
  }

  if (sub === "list") {
    const docs = (await Documents.list(user.id)).slice(0, 10);
    if (!docs.length) return { text: "No documents yet.", blocks: [section("You don't have any documents yet. Try `/superdoc new <prompt>`.")] };
    return {
      text: "Your recent documents",
      blocks: [
        section("*Your recent documents*"),
        section(docs.map((d) => `• *${d.title}* — ${openLink(d.id)}  _(updated ${new Date(d.updatedAt).toLocaleDateString()})_`).join("\n")),
      ],
    };
  }

  if (sub === "open") {
    if (!arg) return { text: "Usage", blocks: [section("Usage: `/superdoc open <title>`")] };
    const docs = await Documents.list(user.id);
    const match = docs.find((d) => d.title.toLowerCase().includes(arg.toLowerCase()));
    if (!match) return { text: "No match.", blocks: [section(`No document matching *${arg}*.`)] };
    return { text: match.title, blocks: [section(`*${match.title}* — ${openLink(match.id)}`)] };
  }

  if (sub === "commit") {
    const docs = await Documents.list(user.id);
    const doc = docs[0];
    if (!doc) return { text: "Nothing to commit.", blocks: [section("You don't have any documents to commit yet.")] };
    const count = (await Versions.list(doc.id, user.id)).length;
    const label = arg || `From Slack · ${stamp()}`;
    await Versions.add({ userId: user.id, documentId: doc.id, label: label.slice(0, 120), contentHtml: doc.contentHtml || "" });
    return { text: "Committed.", blocks: [section(`💾 Committed version ${count + 1} of *${doc.title}* — _${label}_.`)] };
  }

  if (sub === "new") {
    // Handled asynchronously by the route via createDocFromSlash; if it lands
    // here it means the route didn't special-case it.
    return { text: "Use /superdoc new <prompt>", blocks: [section("Usage: `/superdoc new <prompt>`")] };
  }

  return { text: "Unknown command", blocks: [section(`Unknown command \`${sub}\`. Try \`/superdoc help\`.`)] };
}

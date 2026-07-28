import {
  Users, Documents, Chats, Messages, Versions, Changes, Presence,
  SlackInstalls, SlackLinks, SlackThreads,
} from "@/lib/store";
import { runAssistant, summarizeEdits } from "@/lib/gemini";
import { htmlToBlocks, applyOpsToHtml, isHtmlEmpty } from "@/lib/blocks-server";
import { cleanDocHtml } from "@/lib/sanitize";
import { parseFileToHtml, MAX_UPLOAD_BYTES, fileExtension, ACCEPTED_EXTENSIONS } from "@/lib/parse";
import { exportDoc, EXPORT_FORMATS } from "@/lib/export";
import { removeStoredFile } from "@/lib/storage";
import {
  postMessage, uploadFileToSlack, downloadSlackFile, docUrl, connectUrl, signConnectState,
  authTest, conversationsHistory, conversationsReplies, deleteMessage, deleteFile,
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

// Slack backslash-escapes markdown chars (\_ \* \~) in slash-command text, so a
// typed title like verification_letter_… arrives as verification\_letter\_….
const deSlackEscape = (s) => String(s || "").replace(/\\([_*~`>|])/g, "$1");

// Collapse to alphanumerics for forgiving title matching — underscores, dashes,
// spaces, and Slack's escaping all become irrelevant.
const normalizeForMatch = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

function aiErrorText(err) {
  if (err.code === "ai_not_configured") return "The AI isn't configured on the server yet (missing GEMINI_API_KEY).";
  if (err.code === "ai_quota") return err.message;
  return "The AI request failed — please try again.";
}

const FORMAT_ALIAS = { markdown: "md", text: "txt" };
const parseFmt = (s) => {
  const raw = (String(s || "").match(/\b(docx|md|markdown|txt|text|html)\b/i) || [])[1];
  return raw ? (FORMAT_ALIAS[raw.toLowerCase()] || raw.toLowerCase()) : "docx";
};

// Actions are colon-tokens ONLY (:commit: :send: :undo: :rename: :delete:), so a
// natural message can never be mistaken for a command. Anything without a leading
// token is an edit/question.
function parseThreadCommand(text) {
  const token = text.trim().match(/^:(commit|send|undo|rename|delete):\s*([\s\S]*)$/i);
  if (!token) return { action: "edit" };
  const action = token[1].toLowerCase();
  const rest = token[2].trim();
  if (action === "send") return { action: "send", format: parseFmt(rest) };
  if (action === "commit") return { action: "commit", arg: rest };
  if (action === "rename") return { action: "rename", arg: rest };
  if (action === "delete") return { action: "delete", arg: rest };
  return { action: "undo" };
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

// The full reference shown by `/superdoc help` — every feature, command, and
// in-thread action with examples, so users can discover what's possible.
function commandsHelp() {
  return {
    text: "SuperDocs — everything I can do",
    blocks: [
      section("*SuperDocs — everything I can do* 📄\nI create, edit, version, and manage documents right here in Slack, powered by AI. Everything syncs to your SuperDocs account."),
      section(
        "*➕ Create & import*\n" +
        "• `/superdoc new <name>` — create a document with that name\n" +
        "       _example:_ `/superdoc new resume`\n" +
        "• `/superdoc new` — create an untitled doc (I'll name it from your first content)\n" +
        "• *Upload* — drag a `.docx` `.pdf` `.txt` `.rtf` `.md` `.html` file into this chat and I'll import it"
      ),
      section(
        "*💬 Work on a document — reply inside its thread*\n" +
        "When I create or open a doc, I post a *thread*. Do everything by replying in it:\n" +
        "• *Write / add content* — _\"write a resume for a backend engineer\"_\n" +
        "• *Edit* — _\"tighten the intro\"_ · _\"add a Projects section\"_ · _\"make it formal\"_ · _\"translate to Spanish\"_\n" +
        "• *Ask about it* — _\"what's in this doc?\"_ · _\"summarize the key points\"_\n\n" +
        "*Actions* — type the token exactly:\n" +
        "• `:send:` — get the file as Word _(also `:send: md` · `:send: html` · `:send: txt`)_\n" +
        "• `:commit:` or `:commit: <label>` — save a version snapshot\n" +
        "• `:undo:` — revert the last change\n" +
        "• `:rename: <new name>` — rename this document\n" +
        "• `:delete:` — delete this document _(asks you to confirm)_"
      ),
      section(
        "*🔎 Find & open*\n" +
        "• `/superdoc list` — your recent documents\n" +
        "• `/superdoc open <title>` — open an existing doc as a working thread\n" +
        "       _example:_ `/superdoc open rent` opens \"Rent Agreement\" _(partial titles are fine)_"
      ),
      section(
        "*⚙️ Account & cleanup*\n" +
        "• *Connect* — DM me and tap *Connect SuperDocs* _(one-time)_\n" +
        "• `/superdoc disconnect` — unlink, to switch accounts\n" +
        "• `/superdoc clear` — delete all of my messages & files in this chat\n" +
        "• `/superdoc help` — show this list"
      ),
      context("Tip: plain messages don't create anything — use `/superdoc new` or reply inside a document's thread."),
    ],
  };
}

// Short nudge shown when someone messages me outside a document thread.
function helpBlocks() {
  return [
    section("👋 I won't turn a plain message into a document. Use `/superdoc new <name>` to create one, or *reply inside a document's thread* to edit it."),
    context("Type `/superdoc help` to see everything I can do."),
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

async function renameDoc({ botToken, channel, threadTs, user, documentId, name }) {
  const newName = deSlackEscape(name).trim().slice(0, 200);
  if (!newName) { await say(botToken, { channel, threadTs, text: "Usage: `:rename: <new name>`" }); return; }
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  await Documents.update(documentId, user.id, { title: newName });
  await say(botToken, { channel, threadTs, text: `✏️ Renamed *${doc.title}* → *${newName}*.` });
}

// Destructive: wipes the document plus its versions, change history, shares,
// comments and collab state. Requires an explicit `:delete: confirm`.
async function deleteDoc({ botToken, channel, threadTs, user, documentId, confirm }) {
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  if (String(confirm).toLowerCase() !== "confirm") {
    await say(botToken, {
      channel, threadTs,
      text: `⚠️ This *permanently* deletes *${doc.title}* — including its versions and history. This can't be undone.\nType \`:delete: confirm\` to proceed.`,
    });
    return;
  }
  await Documents.remove(documentId, user.id);
  if (doc.sourceFile?.storage?.path) await removeStoredFile(doc.sourceFile.storage.path).catch(() => {});
  await say(botToken, { channel, threadTs, text: `🗑️ Permanently deleted *${doc.title}*. This thread is no longer linked to a document.` });
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
      context('Reply in this thread to edit it — e.g. _"summarize the key points at the top"_. Actions: `:send:` for the file · `:commit:` to snapshot · `:undo:`.'),
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
    await say(botToken, { channel, threadTs, text: "Use `/superdoc new <name>` to create a document, or reply inside a document's thread to edit it.", blocks: helpBlocks() });
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

/* ------------------------- slash: create (/superdoc new) ------------------ */

// Creates a new, EMPTY document titled exactly what the user typed, posts it as
// a thread, and binds the thread. Content is added later by replying in the
// thread. No AI runs at creation time.
export async function createDocFromSlash({ teamId, channel, slackUserId, name, botToken, responseUrl }) {
  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", ...connectPayload(connectUrl(state)) });
    return;
  }

  const title = (deSlackEscape(name).trim() || "Untitled document").slice(0, 200);
  const doc = await Documents.create({ userId: user.id, title, contentHtml: "" });
  const chat = await Chats.create({ userId: user.id, title: title.slice(0, 64), scope: "document", documentId: doc.id });

  try {
    const posted = await postMessage(botToken, {
      channel,
      text: `📄 Created *${title}*`,
      blocks: [
        section(`📄 Created *${title}* — a new, empty document.`),
        context('Reply in this thread to add content — e.g. _"write a resume for a backend engineer"_. Actions: `:send:` for the file · `:commit:` to snapshot · `:undo:` to revert.'),
        section(openLink(doc.id)),
      ],
      unfurl_links: false,
    });
    await SlackThreads.bind({ teamId, channelId: channel, threadTs: posted.ts, userId: user.id, documentId: doc.id, chatId: chat.id });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `✅ Created *${title}* — reply in the thread I posted to add content.` });
  } catch (err) {
    console.error("[superdocs/slack] create post failed:", err);
    await postToResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `✅ Created *${title}*, but I couldn't post it here (${err.code || "error"}). ${openLink(doc.id)}`,
    });
  }
}

/* ------------------------- slash: open (/superdoc open) ------------------- */

// Opens an EXISTING document as a working thread: finds it by (forgiving) title
// match, posts a thread root, binds the thread + a fresh chat, and delivers the
// file — so the user can immediately reply to ask or edit it.
export async function openDocFromSlash({ teamId, channel, slackUserId, query, botToken, responseUrl }) {
  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", ...connectPayload(connectUrl(state)) });
    return;
  }

  const q = deSlackEscape(query).trim();
  if (!q) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: "Usage: `/superdoc open <title>`" });
    return;
  }

  const docs = await Documents.list(user.id);
  const nq = normalizeForMatch(q);
  const doc =
    (nq && docs.find((d) => normalizeForMatch(d.title) === nq)) ||
    (nq && docs.find((d) => normalizeForMatch(d.title).includes(nq)));
  if (!doc) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `No document matching *${q}*. Try \`/superdoc list\`.` });
    return;
  }

  const chat = await Chats.create({ userId: user.id, title: doc.title.slice(0, 64), scope: "document", documentId: doc.id });
  try {
    const posted = await postMessage(botToken, {
      channel,
      text: `📄 Opened *${doc.title}*`,
      blocks: [
        section(`📄 Opened *${doc.title}*`),
        context('Reply in this thread to work with it — e.g. _"what\'s in this doc?"_ or _"add a deadline section"_. Actions: `:send:` · `:commit:` · `:undo:`.'),
        section(openLink(doc.id)),
      ],
      unfurl_links: false,
    });
    await SlackThreads.bind({ teamId, channelId: channel, threadTs: posted.ts, userId: user.id, documentId: doc.id, chatId: chat.id });
    await deliverFile({ botToken, channel, threadTs: posted.ts, doc, comment: `📎 Here's *${doc.title}*.` });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `✅ Opened *${doc.title}* — reply in the thread I posted to work with it.` });
  } catch (err) {
    console.error("[superdocs/slack] open post failed:", err);
    await postToResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `Found *${doc.title}* but couldn't post it here (${err.code || "error"}). ${openLink(doc.id)}`,
    });
  }
}

/* ------------------------ slash: clear (background) ----------------------- */

// Deletes the bot's own messages (and files it posted) in the conversation
// where `/superdoc clear` was run. Slack won't let a user delete a bot's
// messages, so the bot does it. Only messages authored by THIS bot user are
// touched — human and other-app messages are left alone.
export async function clearConversation({ teamId, channel, botToken, responseUrl }) {
  let botUserId = (await SlackInstalls.getByTeam(teamId))?.botUserId;
  if (!botUserId) {
    try { botUserId = (await authTest(botToken)).user_id; } catch {}
  }
  if (!botUserId) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: "Couldn't identify the bot to clear its messages. Make sure the app is installed." });
    return;
  }

  const messageTs = [];
  const fileIds = new Set();
  const collect = (m) => {
    if (m.user !== botUserId) return; // only this bot's own messages
    messageTs.push(m.ts);
    for (const f of m.files || []) if (f.id) fileIds.add(f.id);
  };

  let cursor;
  let pages = 0;
  try {
    do {
      const hist = await conversationsHistory(botToken, { channel, cursor, limit: 200 });
      for (const m of hist.messages || []) {
        // The bot mostly posts as thread replies, which history never returns —
        // walk each thread and collect the bot's replies too.
        if (m.reply_count > 0 || (m.thread_ts && m.thread_ts === m.ts)) {
          let rCursor;
          let rPages = 0;
          do {
            const rep = await conversationsReplies(botToken, { channel, ts: m.thread_ts || m.ts, cursor: rCursor, limit: 200 });
            for (const rm of rep.messages || []) {
              if (rm.ts === m.ts) continue; // parent is collected below
              collect(rm);
            }
            rCursor = rep.response_metadata?.next_cursor;
            rPages++;
          } while (rCursor && rPages < 10);
        }
        collect(m); // the top-level message itself
      }
      cursor = hist.response_metadata?.next_cursor;
      pages++;
    } while (cursor && pages < 10);
  } catch (err) {
    console.error("[superdocs/slack] clear: history read failed:", err);
    const hint = err.code === "missing_scope" ? " (the bot needs history access for this conversation)" : "";
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `Couldn't read this conversation${hint}.` });
    return;
  }

  let deletedMsgs = 0;
  let rateLimited = false;
  for (const ts of messageTs) {
    try {
      await deleteMessage(botToken, channel, ts);
      deletedMsgs++;
    } catch (err) {
      if (err.code === "ratelimited") { rateLimited = true; break; }
      // message_not_found / cant_delete_message — skip and continue
    }
  }

  let deletedFiles = 0;
  for (const id of fileIds) {
    try { await deleteFile(botToken, id); deletedFiles++; } catch {}
  }

  const filePart = deletedFiles ? ` and ${deletedFiles} file${deletedFiles === 1 ? "" : "s"}` : "";
  const morePart = rateLimited ? " — hit Slack's rate limit, run `/superdoc clear` again for the rest" : "";
  await postToResponseUrl(responseUrl, {
    response_type: "ephemeral",
    text: `🧹 Cleared ${deletedMsgs} message${deletedMsgs === 1 ? "" : "s"}${filePart}${morePart}.`,
  });
}

/* ------------------------ slash: fast commands ---------------------------- */

// `/superdoc <sub>` for list / open / commit / help. Returns a payload the route
// sends as an ephemeral reply. (`new` is handled by createDocFromSlash.)
export async function handleSlashCommand({ teamId, slackUserId, text }) {
  const parts = String(text || "").trim().split(/\s+/);
  const sub = (parts[0] || "").toLowerCase();
  const arg = parts.slice(1).join(" ").trim();

  // These work without (or regardless of) an account link.
  if (!sub || sub === "help") {
    return commandsHelp();
  }

  if (sub === "disconnect") {
    const existing = await SlackLinks.get(teamId, slackUserId);
    if (!existing) {
      return { text: "Not connected.", blocks: [section("You're not connected to a SuperDocs account. DM me to connect one.")] };
    }
    await SlackLinks.unlink(teamId, slackUserId);
    return { text: "Disconnected.", blocks: [section("✅ Disconnected from SuperDocs. DM me *hi* to connect a different account.")] };
  }

  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    return connectPayload(connectUrl(state));
  }

  if (sub === "list") {
    const docs = (await Documents.list(user.id)).slice(0, 25);
    if (!docs.length) return { text: "No documents yet.", blocks: [section("You don't have any documents yet. Try `/superdoc new <name>`.")] };
    return {
      text: "Your recent documents",
      blocks: [
        section("*Your recent documents*"),
        section(docs.map((d) => `• *${d.title}* — ${openLink(d.id)}  _(updated ${new Date(d.updatedAt).toLocaleDateString()})_`).join("\n")),
      ],
    };
  }

  if (sub === "open") {
    const query = deSlackEscape(arg).trim();
    if (!query) return { text: "Usage", blocks: [section("Usage: `/superdoc open <title>`")] };
    const docs = await Documents.list(user.id);
    const nq = normalizeForMatch(query);
    // Prefer an exact (normalized) title, else the first that contains the query.
    const match =
      (nq && docs.find((d) => normalizeForMatch(d.title) === nq)) ||
      (nq && docs.find((d) => normalizeForMatch(d.title).includes(nq)));
    if (!match) return { text: "No match.", blocks: [section(`No document matching *${query}*. Try \`/superdoc list\`.`)] };
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
    return { text: "Use /superdoc new <name>", blocks: [section("Usage: `/superdoc new <name>`")] };
  }

  return { text: "Unknown command", blocks: [section(`Unknown command \`${sub}\`. Try \`/superdoc help\`.`)] };
}

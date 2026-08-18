import { Documents, Versions, Changes } from "@/lib/store";
import { isHtmlEmpty } from "@/lib/blocks-server";
import { exportDoc, EXPORT_FORMATS } from "@/lib/export";
import { removeStoredFile } from "@/lib/storage";
import { uploadFileToSlack } from "@/lib/slack";
import { say, openLink, stamp, deSlackEscape } from "./format";

// In-thread document operations (the :commit: :undo: :send: :rename: :delete:
// tokens) plus the file-delivery helper they and the message handler share.

/**
 * Exports the document and uploads it into the thread. `comment` becomes the
 * message that carries the file. Falls back to a text message + link if the
 * upload fails (e.g. missing files:write scope) so the user isn't left blank.
 */
export async function deliverFile({ botToken, channel, threadTs, doc, format = "docx", comment }) {
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
    console.error("[magicpen/slack] file delivery failed:", err);
    const scopeHint = err.code === "missing_scope" ? " (the bot needs the *files:write* scope — add it and reinstall)" : "";
    await say(botToken, {
      channel, threadTs,
      text: `${comment ? comment + "\n" : ""}Couldn't attach the file${scopeHint}. ${openLink(doc.id)}`,
    });
  }
}

/** `:commit:` — snapshots the current content as a new named version. */
export async function commitDoc({ botToken, channel, threadTs, user, documentId, label }) {
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  const count = (await Versions.list(documentId, user.id)).length;
  const finalLabel = (label && label.trim()) || `From Slack · ${stamp()}`;
  await Versions.add({ userId: user.id, documentId, label: finalLabel.slice(0, 120), contentHtml: doc.contentHtml || "" });
  await say(botToken, { channel, threadTs, text: `💾 Committed version ${count + 1} of *${doc.title}* — _${finalLabel}_.` });
}

/**
 * `:undo:` — reverts to the HTML before the last applied change, records the
 * revert in the change log, and re-delivers the file.
 */
export async function undoDoc({ botToken, channel, threadTs, user, documentId }) {
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

/** `:send:` — delivers the document file in the requested export format. */
export async function sendDocFile({ botToken, channel, threadTs, user, documentId, format }) {
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  await deliverFile({ botToken, channel, threadTs, doc, format, comment: `📎 *${doc.title}*` });
}

/** `:rename: <new name>` — renames the document (200-char cap, de-escaped). */
export async function renameDoc({ botToken, channel, threadTs, user, documentId, name }) {
  const newName = deSlackEscape(name).trim().slice(0, 200);
  if (!newName) { await say(botToken, { channel, threadTs, text: "Usage: `:rename: <new name>`" }); return; }
  const doc = await Documents.get(documentId, user.id);
  if (!doc) { await say(botToken, { channel, threadTs, text: "That document is no longer available." }); return; }
  await Documents.update(documentId, user.id, { title: newName });
  await say(botToken, { channel, threadTs, text: `✏️ Renamed *${doc.title}* → *${newName}*.` });
}

/**
 * `:delete:` — destructive: wipes the document plus its versions, change
 * history, shares, comments and collab state. Requires an explicit
 * `:delete: confirm` — anything else replies with a warning instead.
 */
export async function deleteDoc({ botToken, channel, threadTs, user, documentId, confirm }) {
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
  // Best-effort blob cleanup — the document record is already gone.
  if (doc.sourceFile?.storage?.path) {
    await removeStoredFile(doc.sourceFile.storage.path).catch((err) => {
      console.error("[magicpen/slack] stored file cleanup failed:", err);
    });
  }
  await say(botToken, { channel, threadTs, text: `🗑️ Permanently deleted *${doc.title}*. This thread is no longer linked to a document.` });
}

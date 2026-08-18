import { Documents, SlackThreads } from "@/lib/store";
import { isHtmlEmpty } from "@/lib/blocks-server";
import { parseFileToHtml, MAX_UPLOAD_BYTES, fileExtension, ACCEPTED_EXTENSIONS } from "@/lib/parse";
import { downloadSlackFile } from "@/lib/slack";
import { say, section, context, openLink } from "./format";

// File-upload import: a file shared with the bot becomes a new MagicPen
// document bound to the sharing thread.

/**
 * Imports a Slack file share as a new document: validates extension/size,
 * downloads and parses the file, creates the document, and binds the thread so
 * follow-up replies edit it. Every failure is reported into the thread rather
 * than thrown — an upload should never crash the event handler.
 */
export async function handleUpload({ user, teamId, channel, threadTs, botToken, file }) {
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
    console.error("[magicpen/slack] upload parse failed:", err);
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
      section(`📄 Imported *${parsed.title}* into MagicPen.${parsed.notice ? `\n_${parsed.notice}_` : ""}`),
      context('Reply in this thread to edit it — e.g. _"summarize the key points at the top"_. Actions: `:send:` for the file · `:commit:` to snapshot · `:undo:`.'),
      section(openLink(doc.id)),
    ],
  });
}

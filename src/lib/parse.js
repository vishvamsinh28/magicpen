import { cleanDocHtml, htmlToText } from "@/lib/sanitize";
import { parseDocx } from "./parse/docx";
import { parsePdf } from "./parse/pdf";
import { parseRtf, parseMarkdown, plainTextToHtml, extractBody } from "./parse/text";

/**
 * File import entry point: turns an uploaded file (Buffer) into sanitized
 * editor HTML. Format-specific parsers live under ./parse/; everything they
 * return is run through cleanDocHtml so no unsanitized markup ever reaches
 * the editor or the store.
 */

/** Extensions the upload endpoints accept (lowercase, no dot). */
export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt", "rtf", "md", "markdown", "html", "htm"];

/** Upload size cap in bytes (30 MB) — enforced by every upload route. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

/** Lowercased extension of a filename, "" when it has none. */
export function fileExtension(filename = "") {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/** Document title from a filename: the base name, or a default when empty. */
function titleFromFilename(filename = "") {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base || "Untitled document";
}

/**
 * Parse an uploaded file into { html, text, title, notice }. Throws
 * code-carrying errors the routes translate to specific responses:
 * "unsupported_type", "empty_pdf", and the AI layer's "ai_quota".
 */
export async function parseFileToHtml({ buffer, filename }) {
  const ext = fileExtension(filename);
  let rawHtml;
  let notice = null;

  switch (ext) {
    case "docx":
      rawHtml = await parseDocx(buffer);
      break;
    case "pdf": {
      const pdfResult = await parsePdf(buffer);
      rawHtml = pdfResult.html;
      notice = pdfResult.notice;
      break;
    }
    case "rtf":
      rawHtml = await parseRtf(buffer);
      break;
    case "md":
    case "markdown":
      rawHtml = await parseMarkdown(buffer);
      break;
    case "html":
    case "htm":
      rawHtml = extractBody(buffer.toString("utf8"));
      break;
    case "txt":
      rawHtml = plainTextToHtml(buffer.toString("utf8"));
      break;
    default:
      throw Object.assign(
        new Error(`Unsupported file type ".${ext}". Accepted: PDF, DOCX, TXT, RTF, MD, HTML.`),
        { code: "unsupported_type" }
      );
  }

  const html = cleanDocHtml(rawHtml);
  return {
    html,
    text: htmlToText(html),
    title: titleFromFilename(filename),
    notice,
  };
}

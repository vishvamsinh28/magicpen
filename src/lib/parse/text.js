import { escapeHtml } from "@/lib/sanitize";

/**
 * Parsers for the simple text-based formats: plain text, RTF, Markdown, and
 * raw HTML body extraction. Each returns unsanitized HTML — the parse entry
 * point runs everything through cleanDocHtml afterwards.
 */

/** Blank-line-separated plain text → <p> blocks, with single newlines as <br />. */
export function plainTextToHtml(text) {
  const paragraphs = String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

/** The inner HTML of <body> when present, otherwise the input unchanged. */
export function extractBody(html) {
  const match = String(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : String(html);
}

/**
 * RTF → HTML body via @iarna/rtf-to-html (callback API promisified).
 * Throws with context when the RTF is malformed.
 */
export async function parseRtf(buffer) {
  try {
    const { default: rtfToHTML } = await import("@iarna/rtf-to-html");
    const html = await new Promise((resolve, reject) => {
      rtfToHTML.fromString(buffer.toString("utf8"), (err, out) =>
        err ? reject(err) : resolve(out)
      );
    });
    return extractBody(html);
  } catch (err) {
    throw new Error(`RTF conversion failed: ${err.message}`, { cause: err });
  }
}

/** Markdown → HTML via marked (synchronous mode). Throws with context on failure. */
export async function parseMarkdown(buffer) {
  try {
    const { marked } = await import("marked");
    return marked.parse(buffer.toString("utf8"), { async: false });
  } catch (err) {
    throw new Error(`Markdown conversion failed: ${err.message}`, { cause: err });
  }
}

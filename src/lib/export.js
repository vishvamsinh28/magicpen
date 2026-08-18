import { htmlToText } from "@/lib/sanitize";

/**
 * Shared document export: sanitized HTML -> docx / markdown / html / txt.
 * Used by the /api/export route (browser downloads) and the Slack bot (file
 * delivery), so the two paths always produce identical files.
 */

/** Formats exportDoc understands, in UI display order. */
export const EXPORT_FORMATS = ["docx", "md", "html", "txt"];

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

const DOC_STYLES = `body{font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1f1e1b}h1{font-size:20pt}h2{font-size:15pt}h3{font-size:12.5pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}mark{background-color:#fef08a}`;

// Word/Markdown/Text can't express right-floated tail spans — turn
// "Company<span float:right>Location</span>" into "Company — Location"
// so the pair doesn't end up glued together.
function flattenTailSpans(html) {
  return html.replace(
    /<span[^>]*style="[^"]*float:\s*right[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner) => ` — ${inner}`
  );
}

// Filesystem-safe filename: forbidden characters stripped, length capped.
function safeFilename(title, ext) {
  const base = (title || "document").replace(/[\\/:*?"<>|]+/g, "").trim() || "document";
  return `${base.slice(0, 80)}.${ext}`;
}

// html-to-docx ignores <mark> but maps span background-color to real Word
// shading — swap so highlights survive. Marks with no inline color get the
// editor's default yellow.
async function toDocx(html, title) {
  try {
    const { default: htmlToDocx } = await import("html-to-docx");
    const docxHtml = flattenTailSpans(html).replace(
      /<mark\b([^>]*)>([\s\S]*?)<\/mark>/gi,
      (_, attrs, inner) => {
        const color = /background-color:\s*([^;"']+)/i.exec(attrs)?.[1].trim() || "#fef08a";
        return `<span style="background-color:${color}">${inner}</span>`;
      }
    );
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${DOC_STYLES}</style></head><body>${docxHtml}</body></html>`;
    return await htmlToDocx(fullHtml, null, {
      title,
      font: "Calibri",
      table: { row: { cantSplit: true } },
    });
  } catch (err) {
    throw new Error(`DOCX export failed: ${err.message}`, { cause: err });
  }
}

async function toMarkdown(html) {
  try {
    const { default: TurndownService } = await import("turndown");
    const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    return turndown.turndown(flattenTailSpans(html));
  } catch (err) {
    throw new Error(`Markdown export failed: ${err.message}`, { cause: err });
  }
}

/**
 * Convert sanitized document HTML into a downloadable file.
 * Returns { body: Buffer|string, filename, mimetype }. Throws an error with
 * code "bad_format" for an unrecognized format — routes surface that message
 * verbatim, so keep it user-readable.
 */
export async function exportDoc({ html, title = "document", format = "docx" }) {
  if (format === "docx") {
    const buffer = await toDocx(html, title);
    return { body: buffer, filename: safeFilename(title, "docx"), mimetype: MIME.docx };
  }

  if (format === "md") {
    return { body: await toMarkdown(html), filename: safeFilename(title, "md"), mimetype: MIME.md };
  }

  if (format === "html") {
    const page = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<style>${DOC_STYLES}body{max-width:820px;margin:48px auto;padding:0 24px}</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
    return { body: page, filename: safeFilename(title, "html"), mimetype: MIME.html };
  }

  if (format === "txt") {
    return { body: htmlToText(flattenTailSpans(html)), filename: safeFilename(title, "txt"), mimetype: MIME.txt };
  }

  throw Object.assign(new Error(`Unknown format "${format}"`), { code: "bad_format" });
}

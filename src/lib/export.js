import { htmlToText } from "@/lib/sanitize";

// Shared document export: sanitized HTML -> docx / markdown / html / txt.
// Used by the /api/export route (browser downloads) and the Slack bot (file
// delivery), so the two paths always produce identical files.

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

export function safeFilename(title, ext) {
  const base = (title || "document").replace(/[\\/:*?"<>|]+/g, "").trim() || "document";
  return `${base.slice(0, 80)}.${ext}`;
}

// Returns { body: Buffer|string, filename, mimetype }. Throws { code:"bad_format" }
// for an unrecognized format.
export async function exportDoc({ html, title = "document", format = "docx" }) {
  if (format === "docx") {
    const { default: htmlToDocx } = await import("html-to-docx");
    // html-to-docx ignores <mark> but maps span background-color to real Word
    // shading — swap so highlights survive. Marks with no inline color get the
    // editor's default yellow.
    const docxHtml = flattenTailSpans(html).replace(
      /<mark\b([^>]*)>([\s\S]*?)<\/mark>/gi,
      (_, attrs, inner) => {
        const color = /background-color:\s*([^;"']+)/i.exec(attrs)?.[1].trim() || "#fef08a";
        return `<span style="background-color:${color}">${inner}</span>`;
      }
    );
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${DOC_STYLES}</style></head><body>${docxHtml}</body></html>`;
    const buffer = await htmlToDocx(fullHtml, null, {
      title,
      font: "Calibri",
      table: { row: { cantSplit: true } },
    });
    return { body: buffer, filename: safeFilename(title, "docx"), mimetype: MIME.docx };
  }

  if (format === "md") {
    const { default: TurndownService } = await import("turndown");
    const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    return { body: turndown.turndown(flattenTailSpans(html)), filename: safeFilename(title, "md"), mimetype: MIME.md };
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

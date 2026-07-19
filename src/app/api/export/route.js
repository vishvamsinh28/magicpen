import { cleanDocHtml, htmlToText } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

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

function safeFilename(title, ext) {
  const base = (title || "document").replace(/[\\/:*?"<>|]+/g, "").trim() || "document";
  return `${base.slice(0, 80)}.${ext}`;
}

function fileResponse(body, { filename, type }) {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { title = "document", format = "docx" } = body;
  const html = cleanDocHtml(body.html || "");

  if (!html) {
    return Response.json({ error: { message: "Nothing to export — the document is empty" } }, { status: 400 });
  }

  try {
    if (format === "docx") {
      const { default: htmlToDocx } = await import("html-to-docx");
      // html-to-docx ignores <mark> but maps span background-color to real
      // Word shading — swap so highlights survive the export.
      const docxHtml = flattenTailSpans(html).replace(
        /<mark style="background-color:([^"]+)"[^>]*>([\s\S]*?)<\/mark>/gi,
        '<span style="background-color:$1">$2</span>'
      );
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${DOC_STYLES}</style></head><body>${docxHtml}</body></html>`;
      const buffer = await htmlToDocx(fullHtml, null, {
        title,
        font: "Calibri",
        table: { row: { cantSplit: true } },
      });
      return fileResponse(buffer, {
        filename: safeFilename(title, "docx"),
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }

    if (format === "md") {
      const { default: TurndownService } = await import("turndown");
      const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
      const md = turndown.turndown(flattenTailSpans(html));
      return fileResponse(md, { filename: safeFilename(title, "md"), type: "text/markdown; charset=utf-8" });
    }

    if (format === "html") {
      const page = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<style>${DOC_STYLES}body{max-width:820px;margin:48px auto;padding:0 24px}</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
      return fileResponse(page, { filename: safeFilename(title, "html"), type: "text/html; charset=utf-8" });
    }

    if (format === "txt") {
      return fileResponse(htmlToText(flattenTailSpans(html)), { filename: safeFilename(title, "txt"), type: "text/plain; charset=utf-8" });
    }

    return Response.json({ error: { message: `Unknown format "${format}"` } }, { status: 400 });
  } catch (err) {
    console.error("[superdocs] export failed:", err);
    return Response.json({ error: { message: "Export failed. Please try again." } }, { status: 500 });
  }
}

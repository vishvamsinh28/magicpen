import { cleanDocHtml, htmlToText, escapeHtml } from "./sanitize";

// Turns an uploaded file (Buffer) into sanitized editor HTML.

export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt", "rtf", "md", "markdown", "html", "htm"];
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

export function fileExtension(filename = "") {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function titleFromFilename(filename = "") {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base || "Untitled document";
}

function plainTextToHtml(text) {
  const paragraphs = String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

// PDFs come back as raw lines; merge them into paragraphs and guess headings.
function pdfTextToHtml(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      blocks.push(`<p>${escapeHtml(current.join(" "))}</p>`);
      current = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const isHeading =
      line.length <= 70 &&
      current.length === 0 &&
      !/[.,;]$/.test(line) &&
      (line === line.toUpperCase() || /^([A-Z0-9][^\s]*\s*){1,8}$/.test(line)) &&
      /[A-Za-z]/.test(line);
    if (isHeading && line.split(" ").length <= 10) {
      flush();
      blocks.push(`<h2>${escapeHtml(line)}</h2>`);
      continue;
    }
    current.push(line);
    // Short lines usually mean the paragraph ended there.
    if (line.length < 55 && /[.!?:]$/.test(line)) flush();
  }
  flush();
  return blocks.join("\n");
}

function extractBody(html) {
  const match = String(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : String(html);
}

async function parseDocx(buffer) {
  const { default: mammoth } = await import("mammoth");
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

async function parsePdf(buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.map((page) => pdfTextToHtml(page)).join("\n");
}

async function parseRtf(buffer) {
  const { default: rtfToHTML } = await import("@iarna/rtf-to-html");
  const html = await new Promise((resolve, reject) => {
    rtfToHTML.fromString(buffer.toString("utf8"), (err, out) =>
      err ? reject(err) : resolve(out)
    );
  });
  return extractBody(html);
}

async function parseMarkdown(buffer) {
  const { marked } = await import("marked");
  return marked.parse(buffer.toString("utf8"), { async: false });
}

export async function parseFileToHtml({ buffer, filename }) {
  const ext = fileExtension(filename);
  let rawHtml;

  switch (ext) {
    case "docx":
      rawHtml = await parseDocx(buffer);
      break;
    case "pdf":
      rawHtml = await parsePdf(buffer);
      break;
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
  };
}

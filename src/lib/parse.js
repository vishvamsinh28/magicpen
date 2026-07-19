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

const MAX_PDF_IMAGES = 8;
const MAX_IMAGE_DATA_URI = 1_500_000;

// Pull embedded raster images out of the PDF and re-encode as PNG data URIs
// (downscaled to ≤1000px). The model can't emit image bytes itself — it only
// places `pdf:N` placeholders that we substitute afterwards.
async function extractPdfImages(pdf) {
  const images = [];
  try {
    const { extractImages } = await import("unpdf");
    const { PNG } = await import("pngjs");

    for (let pageNum = 1; pageNum <= pdf.numPages && images.length < MAX_PDF_IMAGES; pageNum++) {
      let pageImages = [];
      try {
        pageImages = await extractImages(pdf, pageNum);
      } catch {
        continue;
      }
      for (const image of pageImages) {
        if (images.length >= MAX_PDF_IMAGES) break;
        const { width, height, channels, data } = image;
        if (!width || !height || !data || width < 24 || height < 24) continue; // skip icons/artifacts

        const factor = Math.max(1, Math.ceil(Math.max(width, height) / 1000));
        const w = Math.floor(width / factor);
        const h = Math.floor(height / factor);
        const png = new PNG({ width: w, height: h });
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const si = (y * factor * width + x * factor) * channels;
            const di = (y * w + x) * 4;
            png.data[di] = data[si];
            png.data[di + 1] = channels >= 3 ? data[si + 1] : data[si];
            png.data[di + 2] = channels >= 3 ? data[si + 2] : data[si];
            png.data[di + 3] = channels === 4 ? data[si + 3] : 255;
          }
        }
        const encoded = PNG.sync.write(png);
        const dataUri = `data:image/png;base64,${encoded.toString("base64")}`;
        if (dataUri.length > MAX_IMAGE_DATA_URI) continue;
        images.push({ page: pageNum, width: w, height: h, dataUri });
      }
    }
  } catch (err) {
    console.warn("[superdocs] PDF image extraction skipped:", err.message);
  }
  return images;
}

async function parsePdf(buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));

  // Hyperlink URLs live in annotations, which text extraction (and the model's
  // view of the page) can't see — collect them for the conversion prompt.
  const links = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      for (const annotation of await page.getAnnotations()) {
        if (annotation.url && !links.includes(annotation.url)) links.push(annotation.url);
      }
    }
  } catch {}

  // Probe the text layer first: a PDF with none is a scan, where the only
  // "image" is the page itself — placeholders would duplicate the transcript.
  const { text: probeText } = await extractText(pdf, { mergePages: false });
  const textPages = Array.isArray(probeText) ? probeText : [probeText];
  const hasTextLayer = textPages.join("").trim().length > 0;

  const images = hasTextLayer ? await extractPdfImages(pdf) : [];

  // Best path: Gemini reads the PDF natively and returns structured HTML with
  // headings, lists, bold/italics, hyperlinks, and image placeholders intact.
  const { pdfToStructuredHtml } = await import("./gemini");
  let structured = null;
  let aiError = null;
  try {
    structured = await pdfToStructuredHtml(
      buffer,
      links,
      images.map((im, i) => ({ index: i + 1, page: im.page, width: im.width, height: im.height }))
    );
  } catch (err) {
    aiError = err; // e.g. quota exhausted — try the text fallback first
  }
  if (structured) {
    // Swap `pdf:N` placeholders for the real extracted images; drop anything
    // else the model may have invented (hallucinated srcs render broken).
    let html = structured.replace(/<img[^>]*src="pdf:(\d+)"[^>]*\/?>/gi, (match, n) => {
      const im = images[Number(n) - 1];
      return im ? `<img src="${im.dataUri}" alt="" />` : "";
    });
    html = html.replace(/<img(?![^>]*src="data:)[^>]*\/?>/gi, "");
    return html;
  }

  // Fallback (no API key / oversized / model error): plain text extraction.
  const fallbackHtml = textPages.map((page) => pdfTextToHtml(page)).join("\n");

  // A scanned PDF has no text layer — the fallback yields nothing. Better to
  // fail loudly (with the AI error when there is one) than import emptiness.
  if (!fallbackHtml.replace(/<[^>]+>/g, "").trim()) {
    if (aiError) throw aiError;
    throw Object.assign(
      new Error(
        "This PDF looks like a scan with no selectable text. AI import can read scans — add GEMINI_API_KEY (or retry once your quota resets) and upload again."
      ),
      { code: "empty_pdf" }
    );
  }
  return fallbackHtml;
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

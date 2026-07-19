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

// Pull raw raster images out of the PDF (pixel data + dimensions per page).
async function extractRawImages(pdf) {
  const rasters = [];
  try {
    const { extractImages } = await import("unpdf");
    for (let pageNum = 1; pageNum <= pdf.numPages && rasters.length < MAX_PDF_IMAGES; pageNum++) {
      let pageImages = [];
      try {
        pageImages = await extractImages(pdf, pageNum);
      } catch {
        continue;
      }
      for (const image of pageImages) {
        if (rasters.length >= MAX_PDF_IMAGES) break;
        const { width, height, channels, data } = image;
        if (!width || !height || !data || width < 24 || height < 24) continue; // skip icons/artifacts
        rasters.push({ page: pageNum, width, height, channels, data });
      }
    }
  } catch (err) {
    console.warn("[superdocs] PDF image extraction skipped:", err.message);
  }
  return rasters;
}

// Encode a raster region as a PNG data URI. `box` is [ymin,xmin,ymax,xmax]
// normalized to 0–1000 (whole image when omitted). Nearest-neighbor downscale
// keeps the longest edge ≤ maxDim.
function encodeRasterRegion(raster, PNG, box = null, maxDim = 1000) {
  const { width, height, channels, data } = raster;
  let x0 = 0, y0 = 0, x1 = width, y1 = height;
  if (box) {
    const PAD = 12; // model boxes run tight — breathe ~1.2% on every side
    const [ymin, xmin, ymax, xmax] = box.map((v) => Math.max(0, Math.min(1000, v)));
    if (ymax - ymin < 8 || xmax - xmin < 8) return null; // degenerate box
    x0 = Math.floor((Math.max(0, xmin - PAD) / 1000) * width);
    x1 = Math.ceil((Math.min(1000, xmax + PAD) / 1000) * width);
    y0 = Math.floor((Math.max(0, ymin - PAD) / 1000) * height);
    y1 = Math.ceil((Math.min(1000, ymax + PAD) / 1000) * height);
  }
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 16 || ch < 16) return null;

  const factor = Math.max(1, Math.ceil(Math.max(cw, ch) / maxDim));
  const w = Math.floor(cw / factor);
  const h = Math.floor(ch / factor);
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y * factor) * width + (x0 + x * factor)) * channels;
      const di = (y * w + x) * 4;
      png.data[di] = data[si];
      png.data[di + 1] = channels >= 3 ? data[si + 1] : data[si];
      png.data[di + 2] = channels >= 3 ? data[si + 2] : data[si];
      png.data[di + 3] = channels === 4 ? data[si + 3] : 255;
    }
  }
  const dataUri = `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
  return dataUri.length > MAX_IMAGE_DATA_URI ? null : dataUri;
}

// Pair each link annotation's URL with the text under its rectangle, so links
// can be re-attached deterministically even if the model forgets them.
async function extractLinkAnchors(pdf) {
  const anchors = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const linkAnnots = (await page.getAnnotations()).filter((a) => a.url && a.rect);
      if (!linkAnnots.length) continue;
      const textContent = await page.getTextContent();
      for (const annot of linkAnnots) {
        const [x1, y1, x2, y2] = annot.rect;
        const parts = [];
        for (const item of textContent.items) {
          const tx = item.transform?.[4];
          const ty = item.transform?.[5];
          if (tx == null) continue;
          if (tx >= x1 - 2 && tx <= x2 + 2 && ty >= y1 - 3 && ty <= y2 + 3) parts.push(item.str);
        }
        const text = parts.join("").replace(/\s+/g, " ").trim();
        anchors.push({ url: annot.url, text: text.length >= 3 && text.length <= 120 ? text : null });
      }
    }
  } catch {}
  return anchors;
}

// Wrap any anchor text whose URL the model failed to attach. Existing links
// and float-right tail spans (plain-text by design) are left untouched.
function ensureLinks(html, anchors) {
  const isInsideTag = (segment, index) =>
    segment.lastIndexOf("<", index) > segment.lastIndexOf(">", index);

  for (const { url, text } of anchors) {
    if (!text || html.includes(`href="${url}"`)) continue;
    const segments = html.split(/(<a [\s\S]*?<\/a>|<span[^>]*float:\s*right[^>]*>[\s\S]*?<\/span>)/gi);
    for (let i = 0; i < segments.length; i += 2) {
      const idx = segments[i].indexOf(text);
      if (idx === -1 || isInsideTag(segments[i], idx)) continue;
      const safeUrl = url.replace(/"/g, "%22");
      segments[i] =
        segments[i].slice(0, idx) +
        `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>` +
        segments[i].slice(idx + text.length);
      html = segments.join("");
      break;
    }
  }
  return html;
}

async function parsePdf(buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));

  // Hyperlink URLs live in annotations, which text extraction (and the model's
  // view of the page) can't see — collect them for the conversion prompt.
  const anchors = await extractLinkAnchors(pdf);
  const links = [...new Set(anchors.map((a) => a.url))];

  // Probe the text layer first: a PDF with none is a scan, where the only
  // "image" is the page itself — inserting it whole would duplicate the
  // transcript, so scans instead get graphics cropped out by bounding box.
  const { text: probeText } = await extractText(pdf, { mergePages: false });
  const textPages = Array.isArray(probeText) ? probeText : [probeText];
  const hasTextLayer = textPages.join("").trim().length > 0;

  const { PNG } = await import("pngjs");
  const rasters = await extractRawImages(pdf);

  let placeholders = [];
  let scanPages = [];
  if (hasTextLayer) {
    // Digital PDF: each embedded image becomes a pdf:N placeholder.
    placeholders = rasters
      .map((raster) => ({ raster, dataUri: encodeRasterRegion(raster, PNG) }))
      .filter((p) => p.dataUri)
      .map((p, i) => ({
        index: i + 1,
        page: p.raster.page,
        width: p.raster.width,
        height: p.raster.height,
        dataUri: p.dataUri,
      }));
  } else {
    // Scan: offer per-page rasters for bounding-box cropping (logo, signature…).
    scanPages = [...new Set(rasters.map((r) => r.page))];
  }

  // Best path: Gemini reads the PDF natively and returns structured HTML with
  // headings, lists, bold/italics, hyperlinks, and image placeholders intact.
  const { pdfToStructuredHtml } = await import("./gemini");
  let structured = null;
  let aiError = null;
  try {
    structured = await pdfToStructuredHtml(buffer, links, {
      placeholders: placeholders.map(({ index, page, width, height }) => ({ index, page, width, height })),
      scanPages,
    });
  } catch (err) {
    aiError = err; // e.g. quota exhausted — try the text fallback first
  }
  if (structured) {
    // Swap `pdf:N` placeholders for embedded images…
    let html = structured.replace(/<img[^>]*src="pdf:(\d+)"[^>]*\/?>/gi, (match, n) => {
      const im = placeholders[Number(n) - 1];
      return im ? `<img src="${im.dataUri}" alt="" />` : "";
    });
    // …and `scan:P:box` placeholders for regions cropped out of scanned pages.
    html = html.replace(
      /<img[^>]*src="scan:(\d+):\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)"[^>]*\/?>/gi,
      (match, page, ymin, xmin, ymax, xmax) => {
        const raster = rasters.find((r) => r.page === Number(page));
        if (!raster) return "";
        const dataUri = encodeRasterRegion(raster, PNG, [ymin, xmin, ymax, xmax].map(Number));
        return dataUri ? `<img src="${dataUri}" alt="" />` : "";
      }
    );
    // Drop anything else the model may have invented (hallucinated srcs render broken).
    html = html.replace(/<img(?![^>]*src="data:)[^>]*\/?>/gi, "");
    // Guarantee every PDF hyperlink survives, whatever the model did with them.
    html = ensureLinks(html, anchors);
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

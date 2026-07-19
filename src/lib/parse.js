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

// Word's fixed highlight palette → hex, so highlighter marks survive import
// (mammoth drops highlights unless mapped explicitly).
const WORD_HIGHLIGHTS = {
  yellow: "#ffff00", green: "#00ff00", cyan: "#00ffff", magenta: "#ff00ff",
  blue: "#0000ff", red: "#ff0000", darkBlue: "#00008b", darkCyan: "#008b8b",
  darkGreen: "#006400", darkMagenta: "#800080", darkRed: "#8b0000",
  darkYellow: "#808000", darkGray: "#a9a9a9", lightGray: "#d3d3d3",
  black: "#000000", white: "#ffffff",
};

// Mammoth deliberately drops text colors, and run shading (w:shd) entirely —
// pull styled runs straight out of the DOCX XML (in document order, merged
// per paragraph) and re-apply them after conversion.
async function extractDocxRunStyles(buffer) {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) return [];

    const decode = (s) =>
      s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    const styled = [];
    for (const paragraph of xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []) {
      let current = null; // merge consecutive runs with identical styling
      for (const run of paragraph.match(/<w:r\b[\s\S]*?<\/w:r>/g) || []) {
        let color = run.match(/<w:color[^>]*w:val="([0-9A-Fa-f]{6})"/)?.[1]?.toLowerCase() || null;
        if (color === "000000") color = null;
        let shading = run.match(/<w:shd[^>]*w:fill="([0-9A-Fa-f]{6})"/)?.[1]?.toLowerCase() || null;
        if (shading === "ffffff") shading = null;
        const text = decode(
          [...run.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("")
        );
        if ((color || shading) && text) {
          if (current && current.color === color && current.shading === shading) {
            current.text += text;
          } else {
            if (current) styled.push(current);
            current = { color, shading, text };
          }
        } else {
          if (current) styled.push(current);
          current = null;
        }
      }
      if (current) styled.push(current);
    }
    return styled
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text.length >= 2 && s.text.length <= 300);
  } catch {
    return [];
  }
}

async function parseDocx(buffer) {
  const { default: mammoth } = await import("mammoth");
  const styleMap = [
    ...Object.keys(WORD_HIGHLIGHTS).map(
      (color) => `highlight[color='${color}'] => mark.hl-${color}`
    ),
    "highlight => mark.hl-yellow",
  ];
  const result = await mammoth.convertToHtml({ buffer }, { styleMap });
  // Classes don't survive sanitization — turn them into inline styles now.
  let html = result.value.replace(/<mark class="hl-(\w+)">/g, (match, color) => {
    const hex = WORD_HIGHLIGHTS[color] || WORD_HIGHLIGHTS.yellow;
    return `<mark style="background-color:${hex}">`;
  });
  // Re-apply the text colors and run shading mammoth dropped. Shading wraps
  // outside, color inside: <mark…><span…>text</span></mark>.
  for (const { text, color, shading } of await extractDocxRunStyles(buffer)) {
    const open =
      (shading ? `<mark style="background-color:#${shading}">` : "") +
      (color ? `<span style="color:#${color}">` : "");
    const close = (color ? "</span>" : "") + (shading ? "</mark>" : "");
    const wrapped = wrapPlainText(html, text, open, close);
    if (wrapped) html = wrapped;
  }
  return html;
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

// Text under an annotation rectangle. Items that start before the rect but
// overlap it (mid-line links/highlights) contribute a substring sliced by
// average character width — approximate, but reliable for one-line runs.
function textInRect(textContent, rect) {
  const [x1, y1, x2, y2] = rect;
  const parts = [];
  for (const item of textContent.items) {
    const tx = item.transform?.[4];
    const ty = item.transform?.[5];
    if (tx == null || !item.str) continue;
    if (ty < y1 - 3 || ty > y2 + 3) continue; // baseline outside vertically
    const width = item.width || 0;
    const endX = tx + width;
    if (endX < x1 - 2 || tx > x2 + 2) continue; // no horizontal overlap
    if (tx >= x1 - 2 && endX <= x2 + 2) {
      parts.push(item.str); // fully inside
    } else if (width > 0 && item.str.length > 1) {
      // Proportional slice, then snap outward to word boundaries — average
      // char width is off by a glyph or two on mixed-width text.
      const charWidth = width / item.str.length;
      let from = Math.max(0, Math.round((x1 - tx) / charWidth));
      let to = Math.min(item.str.length, Math.round((x2 - tx) / charWidth));
      while (from > 0 && item.str[from - 1] !== " ") from--;
      while (to < item.str.length && item.str[to] !== " ") to++;
      if (to > from) parts.push(item.str.slice(from, to));
    } else {
      parts.push(item.str);
    }
  }
  return parts.join("").replace(/\s+/g, " ").trim();
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
        const text = textInRect(textContent, annot.rect);
        anchors.push({ url: annot.url, text: text.length >= 3 && text.length <= 120 ? text : null });
      }
    }
  } catch {}
  return anchors;
}

// Highlight / Underline / StrikeOut annotations (someone marked up the PDF in
// a reader) → the corresponding editor formatting, with the annotation color.
async function extractMarkupAnnotations(pdf) {
  const markups = [];
  const SUBTYPES = { Highlight: "mark", Underline: "u", StrikeOut: "s" };
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const annots = (await page.getAnnotations()).filter((a) => SUBTYPES[a.subtype] && a.rect);
      if (!annots.length) continue;
      const textContent = await page.getTextContent();
      for (const annot of annots) {
        const text = textInRect(textContent, annot.rect);
        if (text.length < 2 || text.length > 200) continue;
        const color =
          annot.color?.length >= 3
            ? `#${[...annot.color].slice(0, 3).map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
            : "#ffff00";
        markups.push({ kind: SUBTYPES[annot.subtype], text, color });
      }
    }
  } catch {}
  return markups;
}

// Wrap the first plain-text occurrence of `text` with open/close tags,
// skipping regions that are already links, marks, u/s runs, or float tails.
const PROTECTED_SEGMENTS =
  /(<a [\s\S]*?<\/a>|<mark[\s\S]*?<\/mark>|<u>[\s\S]*?<\/u>|<s>[\s\S]*?<\/s>|<span[^>]*style="[^"]*(?:float|color)[^"]*"[^>]*>[\s\S]*?<\/span>)/gi;

// Returns the wrapped html, or null when the text wasn't found in plain form.
function wrapPlainText(html, text, open, close) {
  const isInsideTag = (segment, index) =>
    segment.lastIndexOf("<", index) > segment.lastIndexOf(">", index);

  const segments = html.split(PROTECTED_SEGMENTS);
  for (let i = 0; i < segments.length; i += 2) {
    const idx = segments[i].indexOf(text);
    if (idx === -1 || isInsideTag(segments[i], idx)) continue;
    segments[i] =
      segments[i].slice(0, idx) + open + text + close + segments[i].slice(idx + text.length);
    return segments.join("");
  }
  return null;
}

// The exact annotation text may cross tags the model added ("<strong>WORD</strong> next"),
// so retry with edge words dropped before giving up.
function wrapWithFallbacks(html, text, open, close) {
  const words = text.split(" ");
  const candidates = [text];
  if (words.length > 1) {
    candidates.push(words.slice(0, -1).join(" "), words.slice(1).join(" "));
    if (words.length > 2) candidates.push(words.slice(1, -1).join(" "));
  }
  for (const candidate of candidates) {
    if (candidate.length < 3) continue;
    const wrapped = wrapPlainText(html, candidate, open, close);
    if (wrapped) return wrapped;
  }
  return html;
}

// Wrap any anchor text whose URL the model failed to attach.
function ensureLinks(html, anchors) {
  for (const { url, text } of anchors) {
    if (!text || html.includes(`href="${url}"`)) continue;
    const safeUrl = url.replace(/"/g, "%22");
    html = wrapWithFallbacks(
      html,
      text,
      `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">`,
      "</a>"
    );
  }
  return html;
}

// Apply Highlight/Underline/StrikeOut annotations the model didn't reproduce.
function ensureMarkup(html, markups) {
  for (const { kind, text, color } of markups) {
    const open =
      kind === "mark" ? `<mark style="background-color:${color}">` : `<${kind}>`;
    const close = kind === "mark" ? "</mark>" : `</${kind}>`;
    html = wrapWithFallbacks(html, text, open, close);
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
  const markups = await extractMarkupAnnotations(pdf);

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
  // Designed graphics (certificates, posters): almost no text, no extractable
  // raster images — the artwork is vector drawing instructions that cannot
  // become editable content. Import the text, but say so honestly.
  const designNotice =
    hasTextLayer && rasters.length === 0 && pdf.numPages <= 2 &&
    textPages.join("").trim().length < 400
      ? "This PDF looks like a designed graphic (certificate/poster). Its text was imported, but vector artwork can't become an editable document — keep the original file for sharing as-is."
      : null;

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
    // Guarantee every PDF hyperlink and markup annotation survives, whatever
    // the model did with them.
    html = ensureLinks(html, anchors);
    html = ensureMarkup(html, markups);
    return { html, notice: designNotice };
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
  return { html: fallbackHtml, notice: designNotice };
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

import { escapeHtml } from "@/lib/sanitize";
import { extractRawImages, encodeRasterRegion } from "./pdf-images";
import { extractLinkAnchors, extractMarkupAnnotations } from "./pdf-annotations";
import { ensureLinks, ensureMarkup } from "./annotate";

/**
 * PDF → HTML. Best path is Gemini reading the PDF natively and returning
 * structured HTML; the fallback is heuristic paragraph/heading detection over
 * the raw text layer. Hyperlinks, reader markup, and embedded images are
 * recovered deterministically either way.
 */

// PDFs come back as raw lines; merge them into paragraphs and guess headings.
// Heuristic only — used when the AI path is unavailable.
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

// Swap the model's image placeholders for real data URIs: `pdf:N` → the N-th
// extracted raster, `scan:P:box` → a region cropped out of scanned page P.
// Anything else the model invented is dropped (hallucinated srcs render broken).
function embedImages(structured, { placeholders, rasters, PNG }) {
  let html = structured.replace(/<img[^>]*src="pdf:(\d+)"[^>]*\/?>/gi, (match, n) => {
    const im = placeholders[Number(n) - 1];
    return im ? `<img src="${im.dataUri}" alt="" />` : "";
  });
  html = html.replace(
    /<img[^>]*src="scan:(\d+):\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)"[^>]*\/?>/gi,
    (match, page, ymin, xmin, ymax, xmax) => {
      const raster = rasters.find((r) => r.page === Number(page));
      if (!raster) return "";
      const dataUri = encodeRasterRegion(raster, PNG, [ymin, xmin, ymax, xmax].map(Number));
      return dataUri ? `<img src="${dataUri}" alt="" />` : "";
    }
  );
  return html.replace(/<img(?![^>]*src="data:)[^>]*\/?>/gi, "");
}

/**
 * Convert a PDF buffer to { html, notice }. Throws a code-carrying error for
 * user-addressable failures ("empty_pdf", or the AI layer's "ai_quota" passed
 * through untouched); plain errors get context added for the logs.
 */
export async function parsePdf(buffer) {
  let pdf, PNG, textPages;
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    pdf = await getDocumentProxy(new Uint8Array(buffer));
    // Probe the text layer first: a PDF with none is a scan, where the only
    // "image" is the page itself — inserting it whole would duplicate the
    // transcript, so scans instead get graphics cropped out by bounding box.
    const { text: probeText } = await extractText(pdf, { mergePages: false });
    textPages = Array.isArray(probeText) ? probeText : [probeText];
    ({ PNG } = await import("pngjs"));
  } catch (err) {
    throw new Error(`PDF parse failed: ${err.message}`, { cause: err });
  }

  // Hyperlink URLs live in annotations, which text extraction (and the model's
  // view of the page) can't see — collect them for the conversion prompt.
  const anchors = await extractLinkAnchors(pdf);
  const links = [...new Set(anchors.map((a) => a.url))];
  const markups = await extractMarkupAnnotations(pdf);

  const hasTextLayer = textPages.join("").trim().length > 0;
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
  const { pdfToStructuredHtml } = await import("@/lib/gemini");
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
    let html = embedImages(structured, { placeholders, rasters, PNG });
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

import { MODEL_ID, isQuotaError, quotaError, loadGenAI } from "./config";

// PDF → HTML import via Gemini's native PDF understanding. The prompt text is
// product-tuned (it encodes the editor's exact HTML dialect and float-right
// pairing rules) — never reword it as part of a refactor.

const PDF_CONVERT_PROMPT = `Convert this PDF document into clean, semantic HTML that faithfully preserves its content and structure.

Requirements:
1. Preserve ALL text exactly as written — never summarize, rephrase, reorder, add, or omit anything.
2. Use the correct structure: h1 for the document title, h2/h3 for section headings, p for paragraphs, ul/ol + li for bullet and numbered lists, table/tr/th/td for tabular data.
3. Preserve inline formatting: <strong> for bold, <em> for italics, <u> for underline, <s> for strikethrough. If text is visibly highlighted with a background color (a marker/highlighter effect), wrap it in <mark style="background-color:#RRGGBB"> using a hex close to the visible color (e.g. #ffff00 yellow, #00ffff cyan, #00ff00 green). Preserve visible TEXT COLORS too: non-black text gets <span style="color:#RRGGBB">…</span> (or the color style on the whole block when the entire block is that color) with a hex close to the visible color.
4. Preserve hyperlinks as <a href="...">text</a> — include every link, whether it appears as a URL or as linked text (check link annotations).
5. For multi-column layouts, linearize into natural reading order.
6. When a line pairs left-aligned text with right-aligned text, keep both in ONE element and wrap the right-hand part in <span style="float: right">…</span>. This applies to entry rows (company ↔ location, role or degree ↔ dates) AND to the document header: when contact details sit right-aligned opposite the name, pair each line exactly as printed. Example header where "Email" shares the name's line and "Mobile" shares the links' line:
   <h1>Vishvamsinh Vaghela<span style="float: right">Email : x@y.com</span></h1>
   <p><a href="...">GitHub</a> / <a href="...">LinkedIn</a><span style="float: right">Mobile : +91-0000000000</span></p>
   Entry rows:
   <h3>HackerRank (YC S11)<span style="float: right">Bangalore, India</span></h3>
   <p><em>Software Engineer Intern</em><span style="float: right">Jan 2026 - Apr 2026</span></p>
   CRITICAL: a float-right span must contain PLAIN TEXT ONLY — never <a> links or any other tag inside it (they break the line). Left-side text outside the span may contain links as usual.
7. Allowed tags only: h1 h2 h3 h4 p ul ol li table thead tbody tr th td strong em u s a br hr blockquote span mark img (img exclusively as a pdf:N placeholder when instructed below).
8. Be compact: no empty paragraphs, no decorative separator lines, no redundant whitespace elements.
9. Output ONLY the raw HTML body content — no markdown fences, no <html>/<head>/<body> wrapper, no commentary.`;

// Appends the import-specific instructions: link annotations, embedded-image
// placeholders, or scanned-page graphic regions (mutually exclusive modes).
function buildPdfPrompt({ links, placeholders, scanPages }) {
  let prompt = PDF_CONVERT_PROMPT;
  if (links.length) {
    prompt += `\n\nThe PDF's link annotations contain these URLs — attach each to the text it belongs to (e.g. a "GitHub" label links to the github.com URL, a project name to its repository). Never invent URLs; leave text unlinked if no URL matches:\n${links
      .slice(0, 50)
      .map((u) => `- ${u}`)
      .join("\n")}`;
  }
  if (placeholders.length) {
    prompt += `\n\nThe PDF contains these embedded images. Where each one appears in the document, insert exactly <img src="pdf:N" /> at that position (its real data is substituted later):\n${placeholders
      .map((im) => `- pdf:${im.index} — page ${im.page}, ${im.width}×${im.height}px`)
      .join("\n")}\nOnly reference these pdf:N ids. Never write any other <img> tag or invent image URLs. Omit purely decorative page backgrounds. IMPORTANT: if an image is the scan of the page's own text content (a scanned/photographed document rather than a distinct logo, photo, chart, or figure), omit its placeholder entirely — transcribe the text instead, never both.`;
  } else if (scanPages.length) {
    prompt += `\n\nThis document is a SCAN (no text layer). Transcribe all of its text into the HTML structure as instructed. Additionally, if a scanned page contains a distinct graphic element — a logo, signature, stamp, photo, or chart (NEVER a region of ordinary text) — insert exactly <img src="scan:P:ymin,xmin,ymax,xmax" /> at the position where it appears in the document flow. P is the page number (available scanned pages: ${scanPages.join(", ")}); ymin,xmin,ymax,xmax are integers 0–1000 normalized to that page, top-left origin. Include a small margin around the graphic so nothing is clipped. Example — a logo in the top-left of page 1 spanning 4%–14% of the height and 5%–30% of the width: <img src="scan:1:35,45,145,310" />. Emit no img tags if there are no such graphics.`;
  } else {
    prompt += `\n\nDo not emit any <img> tags — image data is not available for this document.`;
  }
  return prompt;
}

/**
 * Imports a PDF with structure, links, and inline formatting intact using
 * Gemini's native PDF understanding. `links` are URLs from the PDF's link
 * annotations — the model can't see those itself, only the visible text.
 * Returns null when unavailable (no key, MOCK_AI, oversized, non-quota model
 * failure, or non-HTML output) so the caller falls back to text extraction;
 * throws only for quota exhaustion, which must surface to the user.
 */
export async function pdfToStructuredHtml(buffer, links = [], { placeholders = [], scanPages = [] } = {}) {
  if (process.env.MOCK_AI === "1" || !process.env.GEMINI_API_KEY) return null;
  if (buffer.length > 12 * 1024 * 1024) return null; // very large PDFs → text fallback

  const prompt = buildPdfPrompt({ links, placeholders, scanPages });

  const { GoogleGenAI } = await loadGenAI();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const call = (config) =>
    ai.models.generateContent({
      model: MODEL_ID,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
          { text: prompt },
        ],
      }],
      config,
    });

  let response;
  try {
    // Conversion doesn't need reasoning — skipping it cuts the wait massively.
    response = await call({ temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } });
  } catch (firstErr) {
    if (isQuotaError(firstErr)) throw quotaError();
    // Some models reject thinkingConfig entirely — retry once without it.
    try {
      response = await call({ temperature: 0.1 });
    } catch (err) {
      if (isQuotaError(err)) throw quotaError();
      console.warn("[magicpen] Gemini PDF conversion failed, using text fallback:", err.message);
      return null;
    }
  }

  let html = (response.text || "").trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!/^<[a-z]/i.test(html)) return null;
  return html;
}

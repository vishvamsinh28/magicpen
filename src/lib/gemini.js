import { cleanDocHtml, ALLOWED_STYLE_PROP_NAMES } from "./sanitize";

// Gemini-backed document assistant. The model receives the document as
// numbered HTML blocks and returns JSON edit operations that the client
// applies in place — untouched blocks are never regenerated.

// One model for everything: gemini-3.1-flash-lite — newest stable lite
// generation, with the generous free-tier daily quota (gemini-3.5-flash's
// free tier allows only ~20 requests/day). Override with GEMINI_MODEL.
const MODEL_ID = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const TEMPERATURES = { precise: 0.2, balanced: 0.6, creative: 0.95 };

const MAX_DOC_CHARS = 150_000;
const MAX_ATTACHMENT_CHARS = 20_000;
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `You are the SuperDocs assistant — an expert editor embedded in a document editing app. You edit the user's document IN PLACE by returning edit operations; you never make the user copy-paste anything.

The current document is provided as a numbered list of HTML blocks:
[0] <h1>...</h1>
[1] <p>...</p>

You always respond with JSON matching the response schema:
- "reply": short, friendly PLAIN TEXT for the chat (no markdown syntax, no HTML). Describe what you changed or answer the question. 1–3 sentences unless more detail is asked for.
- "edits": array of edit operations (empty array when no change is needed).
- "title": include ONLY when creating a brand-new document or when asked to rename it — a short document title.

Edit operations (indices always refer to the ORIGINAL numbering shown to you):
- {"op":"replace","index":N,"html":"<p>...</p>"} — replace block N (html may contain several blocks).
- {"op":"insertAfter","index":N,"html":"..."} — insert new blocks after block N.
- {"op":"insertBefore","index":N,"html":"..."} — insert new blocks before block N.
- {"op":"delete","index":N} — remove block N.
- {"op":"setDocument","html":"..."} — replace the ENTIRE document. Use ONLY for creating a document from scratch (when empty) or when the user explicitly asks for a full rewrite/replacement.

Rules:
0. Every replace/insertAfter/insertBefore op MUST include the complete "html" string — never omit it, never leave it empty, never describe it elsewhere. Use null only for fields that don't apply ("index" for setDocument, "html" for delete).
1. Edit only what the user asked for. Preserve every other block exactly — never use setDocument for a local change.
2. Inside blocks you edit, keep existing formatting (bold, links, colors, alignment) unless the user asks to change it.
3. Allowed tags: h1-h6, p, ul, ol, li, blockquote, pre, code, table, thead, tbody, tr, th, td, img, a, strong, em, u, s, span, mark, br, hr.
4. Styling uses inline styles, and ONLY these CSS properties exist — anything else is stripped and the user sees no change: color, background-color, font-size (px), line-height, text-align, font-family, font-weight, font-style, text-decoration, float (right only). They work on whole blocks (<p>, <h1>-<h6>, <ul>, <ol>, <li>, <blockquote>) and on <span> for part of a line. For bold/italic/underline/strikethrough ALWAYS prefer the tags <strong>, <em>, <u>, <s>. To highlight text use <mark style="background-color:#fef08a">…</mark>. <span style="float: right">…</span> puts text flush right on the same line — preserve such spans when editing blocks that contain them. Effects with no property here must be achieved differently: UPPERCASE or lowercase → rewrite the text itself in that case; wider gaps between lines/paragraphs → line-height; NEVER use margin, padding, letter-spacing, text-transform, border, box-shadow, or display.
5. To translate or rewrite the whole document, prefer one replace op per block so structure stays aligned.
6. When the document is empty and the user asks to create, write, draft, or load a template, produce a complete well-structured document with setDocument and set "title".
7. Questions about the document get "edits": [] and the answer in "reply".
8. Attached reference files are context; do not copy them wholesale unless asked.
9. Never mention JSON, ops, blocks, or indices in "reply" — speak like a helpful editor ("I've tightened up the introduction.").`;

class AIConfigError extends Error {
  constructor(message) {
    super(message);
    this.code = "ai_not_configured";
  }
}

const isQuotaError = (err) =>
  /RESOURCE_EXHAUSTED|exceeded your current quota|"code"\s*:\s*429/i.test(String(err?.message));

const quotaError = () =>
  Object.assign(
    new Error(
      `Your Gemini API quota for ${MODEL_ID} is used up (the free tier allows ~20 requests/day). Wait for the daily reset or enable billing on your key, then try again.`
    ),
    { code: "ai_quota" }
  );

function buildUserTurn({ message, blocks, docTitle, attachments }) {
  const parts = [];

  if (blocks.length) {
    let total = 0;
    const lines = [];
    for (let i = 0; i < blocks.length; i++) {
      const line = `[${i}] ${blocks[i]}`;
      total += line.length;
      if (total > MAX_DOC_CHARS) {
        lines.push(`[… blocks ${i}–${blocks.length - 1} omitted for length — do not edit them …]`);
        break;
      }
      lines.push(line);
    }
    parts.push(`DOCUMENT TITLE: ${docTitle || "Untitled document"}\nDOCUMENT BLOCKS:\n${lines.join("\n")}`);
  } else {
    parts.push("The document is currently empty.");
  }

  if (attachments?.length) {
    const files = attachments
      .map((a) => `--- ${a.name} ---\n${(a.text || "").slice(0, MAX_ATTACHMENT_CHARS)}`)
      .join("\n\n");
    parts.push(`ATTACHED REFERENCE FILES:\n${files}`);
  }

  parts.push(`USER REQUEST: ${message}`);
  return parts.join("\n\n");
}

function sanitizeResult(raw) {
  const reply = typeof raw?.reply === "string" ? raw.reply.trim() : "";
  const title = typeof raw?.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 120) : null;
  const edits = [];

  for (const edit of Array.isArray(raw?.edits) ? raw.edits : []) {
    const op = edit?.op;
    if (op === "setDocument" && edit.html) {
      edits.push({ op, html: cleanDocHtml(edit.html) });
    } else if (op === "delete" && Number.isInteger(edit.index)) {
      edits.push({ op, index: edit.index });
    } else if (
      ["replace", "insertAfter", "insertBefore"].includes(op) &&
      Number.isInteger(edit.index) &&
      edit.html
    ) {
      edits.push({ op, index: edit.index, html: cleanDocHtml(edit.html) });
    }
  }

  return { reply: reply || (edits.length ? "Done — I've updated the document." : "Okay."), edits, title };
}

// CSS properties the model used that the sanitizer would strip — the classic
// "AI says done, user sees nothing" failure.
function findUnsupportedStyleProps(rawEdits) {
  const bad = new Set();
  for (const edit of rawEdits || []) {
    if (!edit?.html) continue;
    for (const match of String(edit.html).matchAll(/style="([^"]*)"/gi)) {
      for (const declaration of match[1].split(";")) {
        const prop = declaration.split(":")[0]?.trim().toLowerCase();
        if (prop && !ALLOWED_STYLE_PROP_NAMES.includes(prop)) bad.add(prop);
      }
    }
  }
  return [...bad];
}

const normalizeHtml = (s) =>
  String(s || "").replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();

// Replace ops that resend the block unchanged — nothing would visibly happen.
function allEditsNoop(edits, blocks) {
  if (!edits.length) return false;
  return edits.every(
    (edit) =>
      edit.op === "replace" &&
      Number.isInteger(edit.index) &&
      normalizeHtml(edit.html) === normalizeHtml(blocks[edit.index])
  );
}

export function summarizeEdits(edits) {
  if (!edits?.length) return null;
  const labels = edits.map((e) => {
    switch (e.op) {
      case "replace": return `Edited block ${e.index + 1}`;
      case "insertAfter":
      case "insertBefore": return "Added content";
      case "delete": return `Removed block ${e.index + 1}`;
      case "setDocument": return "Rewrote document";
      default: return e.op;
    }
  });
  return [...new Set(labels)].join(" · ");
}

/* --------------------------- PDF → HTML import ---------------------------- */

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

// Uses Gemini's native PDF understanding to import with structure, links, and
// inline formatting intact. `links` are the URLs from the PDF's link
// annotations — the model can't see those itself, only the visible text.
// Returns null when unavailable so the caller can fall back to text extraction.
export async function pdfToStructuredHtml(buffer, links = [], { placeholders = [], scanPages = [] } = {}) {
  if (process.env.MOCK_AI === "1" || !process.env.GEMINI_API_KEY) return null;
  if (buffer.length > 12 * 1024 * 1024) return null; // very large PDFs → text fallback

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

  const { GoogleGenAI } = await import("@google/genai");
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
    try {
      response = await call({ temperature: 0.1 });
    } catch (err) {
      if (isQuotaError(err)) throw quotaError();
      console.warn("[superdocs] Gemini PDF conversion failed, using text fallback:", err.message);
      return null;
    }
  }

  let html = (response.text || "").trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!/^<[a-z]/i.test(html)) return null;
  return html;
}

/* --------------------------------- Mock ---------------------------------- */
// MOCK_AI=1 lets the whole app run without a Gemini key (dev/testing).

const MOCK_DOC = `<h1>Understanding REST APIs: A Guide</h1><p>A <strong>REST API</strong> (Representational State Transfer Application Programming Interface) is an architectural style for providing standards between computer systems on the web, making it easier for systems to communicate with each other.</p><h2>What is an API?</h2><p>API stands for <em>Application Programming Interface</em>. Think of it as a waiter in a restaurant: you (the client) give your order to the waiter (the API), who takes it to the kitchen (the server), and then brings the finished meal (the response) back to you.</p><h2>Key Principles of REST</h2><ul><li><strong>Statelessness</strong> — each request contains all the information needed.</li><li><strong>Cacheability</strong> — responses define themselves as cacheable or not.</li><li><strong>Uniform interface</strong> — resources are identified by URLs and manipulated with HTTP verbs.</li></ul>`;

const inner = (html) => html.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "");

function mockAssistant({ message, blocks }) {
  const m = message.toLowerCase();
  if (!blocks.length && /(create|write|draft|generate|template|load)/.test(m)) {
    return {
      reply: "I've drafted that document for you — take a look on the right and tell me what to tweak.",
      title: "Understanding REST APIs: A Guide",
      edits: [{ op: "setDocument", html: MOCK_DOC }],
    };
  }
  if (blocks.length && /highlight/.test(m)) {
    return {
      reply: "I've highlighted the opening for you.",
      title: null,
      edits: [{ op: "replace", index: 0, html: `<p><mark style="background-color:#fef08a">${inner(blocks[0])}</mark></p>` }],
    };
  }
  if (blocks.length && /bold/.test(m)) {
    return {
      reply: "Made the first block bold.",
      title: null,
      edits: [{ op: "replace", index: 0, html: `<p><strong>${inner(blocks[0])}</strong></p>` }],
    };
  }
  if (blocks.length && /(conclusion|summary)/.test(m)) {
    return {
      reply: "Added a conclusion at the end of the document.",
      title: null,
      edits: [{
        op: "insertAfter",
        index: blocks.length - 1,
        html: "<h2>Conclusion</h2><p>In short, REST APIs give disparate systems a simple, uniform way to exchange data over the web — and that simplicity is exactly why they became the default.</p>",
      }],
    };
  }
  if (blocks.length && /delete (the )?last/.test(m)) {
    return { reply: "Removed the last block.", title: null, edits: [{ op: "delete", index: blocks.length - 1 }] };
  }
  // Multi-op response — exercises the review card's per-edit diffs + selective apply.
  if (blocks.length && /(improve|polish|rewrite)/.test(m)) {
    const idx = Math.min(1, blocks.length - 1);
    return {
      reply: "I've polished the document — reworded a paragraph, added a pro tip, and trimmed the ending.",
      title: null,
      edits: [
        { op: "replace", index: idx, html: `<p>Put simply, ${inner(blocks[idx]).replace(/\bthe\b/i, "this")} That's the core idea.</p>` },
        { op: "insertAfter", index: idx, html: "<p><em>Pro tip:</em> keep every section focused on a single idea.</p>" },
        { op: "delete", index: blocks.length - 1 },
      ],
    };
  }
  return {
    reply: `Mock AI here — I received "${message}". Set GEMINI_API_KEY in .env.local (and remove MOCK_AI) to talk to the real model.`,
    title: null,
    edits: [],
  };
}

/* --------------------------------- Main ----------------------------------- */

export async function runAssistant({
  message,
  blocks = [],
  docTitle = "",
  history = [],
  attachments = [],
  mode = "balanced",
}) {
  if (process.env.MOCK_AI === "1") {
    await new Promise((r) => setTimeout(r, 600));
    return sanitizeResult(mockAssistant({ message, blocks }));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local (or set MOCK_AI=1 to try the app without a key)."
    );
  }

  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const contents = [];
  for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.editSummary ? `${msg.content}\n(Edits applied: ${msg.editSummary})` : msg.content }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: buildUserTurn({ message, blocks, docTitle, attachments }) }],
  });

  const callModel = async (turns) => {
    try {
      return await ai.models.generateContent({
        model: MODEL_ID,
        contents: turns,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: TEMPERATURES[mode] ?? TEMPERATURES.balanced,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              title: { type: Type.STRING, nullable: true },
              edits: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    op: {
                      type: Type.STRING,
                      enum: ["replace", "insertAfter", "insertBefore", "delete", "setDocument"],
                    },
                    index: { type: Type.INTEGER, nullable: true },
                    html: { type: Type.STRING, nullable: true },
                  },
                  // All keys required (nullable where they don't apply) — models
                  // love to omit optional fields, and an edit without html is useless.
                  required: ["op", "index", "html"],
                  propertyOrdering: ["op", "index", "html"],
                },
              },
            },
            required: ["reply", "edits"],
            propertyOrdering: ["reply", "title", "edits"],
          },
        },
      });
    } catch (err) {
      if (isQuotaError(err)) throw quotaError();
      if (/not[_ ]?found|does not exist|404/i.test(String(err?.message))) {
        throw new Error(
          `Model "${MODEL_ID}" isn't available for your API key. Set GEMINI_MODEL in .env.local to a model you can use.`
        );
      }
      throw err;
    }
  };

  const parse = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      // Model occasionally wraps JSON in fences despite JSON mode.
      const match = text?.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("The AI returned an unreadable response. Please try again.");
      return JSON.parse(match[0]);
    }
  };

  let parsed;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await callModel(contents);
    parsed = parse(response.text);
    const rawEdits = Array.isArray(parsed?.edits) ? parsed.edits : [];
    const result = sanitizeResult(parsed);

    // Self-check: catch the ways an edit can "succeed" without the user ever
    // seeing a change, and make the model correct itself once.
    const problems = [];
    if (rawEdits.length && result.edits.length === 0) {
      problems.push(
        'Every replace/insertAfter/insertBefore op must include the complete "html" string (the full edited block) — yours were missing or invalid.'
      );
    }
    const badProps = findUnsupportedStyleProps(rawEdits);
    if (badProps.length) {
      problems.push(
        `You used unsupported style properties (${badProps.join(", ")}) which get stripped — the user would see NO change. Only these work: ${ALLOWED_STYLE_PROP_NAMES.join(", ")}. Achieve the effect with supported means (uppercase → rewrite the text in capitals; spacing → line-height; emphasis → <strong>/<em>/<u>/<s>/<mark>).`
      );
    }
    if (allEditsNoop(result.edits, blocks)) {
      problems.push(
        "Your replace ops resent the blocks UNCHANGED — nothing would happen. Actually apply the requested modification to the content."
      );
    }

    if (!problems.length || attempt === 1) return result;
    console.warn("[superdocs] AI edit self-check failed, retrying once:", problems.join(" | "));
    contents.push(
      { role: "model", parts: [{ text: response.text }] },
      {
        role: "user",
        parts: [{ text: `Fix your response and resend the ENTIRE corrected JSON. ${problems.join(" ")}` }],
      }
    );
  }
  return sanitizeResult(parsed);
}

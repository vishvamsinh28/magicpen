import { cleanDocHtml } from "./sanitize";

// Gemini-backed document assistant. The model receives the document as
// numbered HTML blocks and returns JSON edit operations that the client
// applies in place — untouched blocks are never regenerated.

// One model for everything: gemini-3.5-flash (override with GEMINI_MODEL if
// the ID ever changes).
const MODEL_ID = process.env.GEMINI_MODEL || "gemini-3.5-flash";

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
4. Styling goes in inline styles: color, background-color, font-size (e.g. "18px"), line-height (e.g. "1.5"), text-align. To highlight text use <mark style="background-color:#fef08a">…</mark> (pick a fitting color).
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
    const attempted = Array.isArray(parsed?.edits) ? parsed.edits.length : 0;
    const result = sanitizeResult(parsed);
    // Success, or nothing was attempted — done. Otherwise the model produced
    // edits that didn't survive validation (e.g. missing html): correct once.
    if (attempt === 1 || attempted === 0 || result.edits.length > 0) return result;
    console.warn("[superdocs] AI returned incomplete edit ops — retrying once");
    contents.push(
      { role: "model", parts: [{ text: response.text }] },
      {
        role: "user",
        parts: [{
          text: 'Your previous JSON was invalid: every replace/insertAfter/insertBefore op must include the complete "html" string (the full edited block). Resend the entire corrected JSON now.',
        }],
      }
    );
  }
  return sanitizeResult(parsed);
}

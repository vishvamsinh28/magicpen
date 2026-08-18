import { cleanDocHtml, ALLOWED_STYLE_PROP_NAMES } from "../sanitize";

// Parsing + validation of the model's JSON response. Everything the model
// returns is untrusted: ops are whitelisted, HTML is sanitized, and helpers
// below detect the "AI says done, user sees nothing" failure modes that the
// caller uses to trigger a one-shot self-correction.

/**
 * Parses the model's raw text as JSON. Tolerates the occasional markdown-fence
 * wrapping despite JSON mode by extracting the outermost {...}. Throws a
 * user-presentable error when no JSON can be recovered.
 */
export function parseModelJson(text) {
  const unreadable = () => new Error("The AI returned an unreadable response. Please try again.");
  try {
    return JSON.parse(text);
  } catch {
    const match = text?.match(/\{[\s\S]*\}/);
    if (!match) throw unreadable();
    try {
      return JSON.parse(match[0]);
    } catch {
      throw unreadable();
    }
  }
}

/**
 * Whitelists + sanitizes a raw model result into { reply, edits, title }.
 * Invalid ops (wrong name, missing index/html) are dropped silently; HTML in
 * kept ops is run through cleanDocHtml. Always returns a non-empty reply.
 */
export function sanitizeResult(raw) {
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

// Adds every non-whitelisted property name in one style="" attribute to `bad`.
function addUnsupportedProps(styleText, bad) {
  for (const declaration of styleText.split(";")) {
    const prop = declaration.split(":")[0]?.trim().toLowerCase();
    if (prop && !ALLOWED_STYLE_PROP_NAMES.includes(prop)) bad.add(prop);
  }
}

/**
 * CSS properties the model used that the sanitizer would strip — the classic
 * "AI says done, user sees nothing" failure. Returns the offending property
 * names so the retry prompt can name them.
 */
export function findUnsupportedStyleProps(rawEdits) {
  const bad = new Set();
  for (const edit of rawEdits || []) {
    if (!edit?.html) continue;
    for (const match of String(edit.html).matchAll(/style="([^"]*)"/gi)) {
      addUnsupportedProps(match[1], bad);
    }
  }
  return [...bad];
}

// Whitespace-insensitive HTML comparison, so formatting-only differences in the
// model's echo of a block don't count as a change.
const normalizeHtml = (s) =>
  String(s || "").replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();

/**
 * True when every edit is a replace op that resends its block unchanged —
 * nothing would visibly happen, so the caller asks the model to try again.
 */
export function allEditsNoop(edits, blocks) {
  if (!edits.length) return false;
  return edits.every(
    (edit) =>
      edit.op === "replace" &&
      Number.isInteger(edit.index) &&
      normalizeHtml(edit.html) === normalizeHtml(blocks[edit.index])
  );
}

/**
 * Human-readable one-liner describing a set of edit ops ("Edited block 2 ·
 * Added content"). Returns null for no edits — callers rely on the null to
 * skip the summary line entirely.
 */
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

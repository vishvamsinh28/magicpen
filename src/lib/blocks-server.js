import { parseDocument } from "htmlparser2";
import { textContent, findOne } from "domutils";
import * as DomSerializer from "dom-serializer";

/**
 * Server-side mirror of components/editor/blocks.js. The browser version relies
 * on `document.createElement`; route handlers (e.g. the Slack bot) have no DOM,
 * so here we split and serialize with htmlparser2/dom-serializer instead. The
 * contract is identical: a document is a list of top-level HTML block strings,
 * the AI returns index-based ops, and applying them is a pure HTML→HTML
 * transform that leaves untouched blocks intact.
 */

// dom-serializer ships as CJS; the callable renderer is the default export.
const render = DomSerializer.default ?? DomSerializer;

// Parse with entity decoding on so the serializer can re-encode consistently —
// otherwise pre-encoded entities (&amp;) would be double-escaped on round-trip.
const parse = (html) => parseDocument(String(html || ""), { decodeEntities: true });

const isElement = (node) => node && (node.type === "tag" || node.type === "script" || node.type === "style");

/**
 * Split an HTML document into its top-level element blocks, each re-serialized
 * as an HTML string. Non-element nodes (stray text, comments) are dropped,
 * matching what the TipTap editor would do with them.
 */
export function htmlToBlocks(html) {
  return parse(html)
    .children.filter(isElement)
    .map((el) => render(el));
}

/**
 * True when the HTML has no visible content: no text and none of the
 * self-sufficient media/structure tags (img, table, hr).
 */
export function isHtmlEmpty(html) {
  if (!html) return true;
  const dom = parse(html);
  const hasText = textContent(dom).trim().length > 0;
  const hasMedia = !!findOne(
    (el) => ["img", "table", "hr"].includes(el.name),
    dom.children,
    true
  );
  return !hasText && !hasMedia;
}

/**
 * Apply index-based edit ops to an HTML document and return the new HTML.
 * Identical algorithm to the client's applyOpsToHtml: build a slot per original
 * block, layer before/after insertions and replacements onto it, then flatten.
 * Indices always refer to the ORIGINAL numbering the model was shown.
 */
export function applyOpsToHtml(html, ops = []) {
  const setDoc = ops.find((op) => op && op.op === "setDocument");
  if (setDoc) return setDoc.html || "";

  const blocks = htmlToBlocks(html);
  const slots = blocks.map((blockHtml) => ({
    before: [],
    content: [blockHtml],
    after: [],
    deleted: false,
  }));

  const tail = { before: [], content: [], after: [], deleted: false };

  for (const op of ops) {
    if (!op || typeof op.op !== "string") continue;
    if (!slots.length) {
      if (op.html) tail.after.push(op.html);
      continue;
    }
    const index = Math.max(0, Math.min(Number(op.index) || 0, slots.length - 1));
    const slot = slots[index];
    switch (op.op) {
      case "replace":
        if (op.html) slot.content = [op.html];
        break;
      case "delete":
        slot.deleted = true;
        break;
      case "insertAfter":
        if (op.html) slot.after.push(op.html);
        break;
      case "insertBefore":
        if (op.html) slot.before.push(op.html);
        break;
      default:
        break;
    }
  }

  return [...slots, tail]
    .map((slot) =>
      [...slot.before, ...(slot.deleted ? [] : slot.content), ...slot.after].join("")
    )
    .join("");
}

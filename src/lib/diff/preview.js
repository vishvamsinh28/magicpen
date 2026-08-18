"use client";

import { htmlToBlocks } from "@/components/editor/blocks";
import { diffHtml } from "@/lib/htmldiff";

/**
 * In-document diff preview: the whole document with the selected ops rendered
 * as marks — word-level <ins>/<del> inside replaced blocks (via diffHtml, so
 * tables stay tables), inserted blocks wrapped in .diff-added, deleted blocks
 * in .diff-removed.
 */

/** Tag name of the first element in an HTML string, "" when unrecognizable. */
const rootTag = (html) => (String(html).match(/^\s*<\s*([a-zA-Z0-9-]+)/) || [])[1]?.toLowerCase() || "";

/**
 * Build the preview HTML for `edits` against `beforeHtml`. `deselected` holds
 * indices into `edits` whose ops are previewed as skipped. Mirrors
 * applyOpsToHtml's slot semantics (index clamping, before/content/after
 * layering, trailing tail) so the preview matches what apply would produce.
 */
export function buildDiffPreviewHtml(edits = [], beforeHtml = "", deselected = new Set()) {
  const ops = (edits || []).filter((op) => op && typeof op.op === "string");
  const setDoc = ops.find((op) => op.op === "setDocument");
  if (setDoc) return diffHtml(beforeHtml, setDoc.html || "");

  const blocks = htmlToBlocks(beforeHtml);
  const slots = blocks.map((blockHtml) => ({ before: [], content: blockHtml, after: [] }));
  const tail = { before: [], content: "", after: [] };

  ops.forEach((op, i) => {
    if (deselected.has(i)) return;
    if (!slots.length) {
      if (op.html) tail.after.push(`<div class="diff-added">${op.html}</div>`);
      return;
    }
    const index = Math.max(0, Math.min(Number(op.index) || 0, slots.length - 1));
    const slot = slots[index];
    switch (op.op) {
      case "replace":
        if (op.html) {
          // Inline word marks only work when the block keeps its shape; a
          // p→h2 conversion (or 1→N block split) renders as removed + added.
          const sameShape =
            htmlToBlocks(op.html).length === 1 && rootTag(op.html) === rootTag(blocks[index]);
          slot.content = sameShape
            ? diffHtml(blocks[index], op.html)
            : `<div class="diff-removed">${blocks[index]}</div><div class="diff-added">${op.html}</div>`;
        }
        break;
      case "delete":
        slot.content = `<div class="diff-removed">${blocks[index]}</div>`;
        break;
      case "insertAfter":
        if (op.html) slot.after.push(`<div class="diff-added">${op.html}</div>`);
        break;
      case "insertBefore":
        if (op.html) slot.before.push(`<div class="diff-added">${op.html}</div>`);
        break;
      default:
        break;
    }
  });

  return [...slots, tail]
    .map((slot) => [...slot.before, slot.content, ...slot.after].join(""))
    .join("");
}

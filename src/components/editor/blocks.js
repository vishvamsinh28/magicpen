"use client";

// The document is treated as a list of top-level HTML blocks. The AI receives
// these numbered blocks and returns index-based operations; applying them is a
// pure HTML→HTML transform so untouched blocks are preserved byte-for-byte.
// (src/lib/blocks-server.js mirrors this logic for server-side use.)

/**
 * Splits an HTML string into its top-level element blocks (outerHTML each).
 * Browser-only: relies on the DOM parser for fidelity with what TipTap loads.
 */
export function htmlToBlocks(html) {
  const container = document.createElement("div");
  container.innerHTML = html || "";
  return Array.from(container.children).map((el) => el.outerHTML);
}

/**
 * True when the HTML renders as nothing meaningful — no text content and none
 * of the visible empty-able elements (images, tables, rules).
 */
export function isHtmlEmpty(html) {
  if (!html) return true;
  const container = document.createElement("div");
  container.innerHTML = html;
  return !container.textContent.trim() && !container.querySelector("img, table, hr");
}

/**
 * Applies AI block operations (replace / delete / insertAfter / insertBefore /
 * setDocument) to an HTML document string. Indexes are clamped into range and
 * malformed ops are skipped, so a bad model response can't corrupt the doc;
 * inserts aimed at an empty document land in a synthetic tail slot.
 */
export function applyOpsToHtml(html, ops = []) {
  const setDoc = ops.find((op) => op.op === "setDocument");
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

/**
 * Human-readable {icon, label} summaries of block operations, for the chat's
 * pending-change card. Indexes are read the same way applyOpsToHtml reads
 * them (Number(...) || 0), so labels match what would actually be applied.
 */
export function describeOps(ops = []) {
  if (!Array.isArray(ops)) return [];
  return ops.map((op) => {
    const blockNo = (Number(op?.index) || 0) + 1;
    switch (op?.op) {
      case "replace": return { icon: "edit", label: `Edited block ${blockNo}` };
      case "insertAfter":
      case "insertBefore": return { icon: "plus", label: "Added content" };
      case "delete": return { icon: "minus", label: `Removed block ${blockNo}` };
      case "setDocument": return { icon: "file", label: "Wrote document" };
      default: return { icon: "edit", label: op?.op ?? "edit" };
    }
  });
}

"use client";

// The document is treated as a list of top-level HTML blocks. The AI receives
// these numbered blocks and returns index-based operations; applying them is a
// pure HTML→HTML transform so untouched blocks are preserved byte-for-byte.

export function htmlToBlocks(html) {
  const container = document.createElement("div");
  container.innerHTML = html || "";
  return Array.from(container.children).map((el) => el.outerHTML);
}

export function isHtmlEmpty(html) {
  if (!html) return true;
  const container = document.createElement("div");
  container.innerHTML = html;
  return !container.textContent.trim() && !container.querySelector("img, table, hr");
}

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

export function describeOps(ops = []) {
  return ops.map((op) => {
    switch (op.op) {
      case "replace": return { icon: "edit", label: `Edited block ${op.index + 1}` };
      case "insertAfter":
      case "insertBefore": return { icon: "plus", label: "Added content" };
      case "delete": return { icon: "minus", label: `Removed block ${op.index + 1}` };
      case "setDocument": return { icon: "file", label: "Wrote document" };
      default: return { icon: "edit", label: op.op };
    }
  });
}

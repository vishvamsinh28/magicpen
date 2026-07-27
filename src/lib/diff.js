"use client";

// Turns proposed edit operations into reviewable diffs. Blocks are compared as
// plain text with a word-level LCS diff; formatting-only changes (same text,
// different markup) are detected and previewed instead of diffed.

import { htmlToBlocks } from "@/components/editor/blocks";
import { diffHtml } from "@/lib/htmldiff";

/* ------------------------------ text extract ------------------------------ */

const BREAK_AFTER = /^(p|div|li|tr|td|th|h[1-6]|blockquote|pre|figure|figcaption|br|hr)$/i;

// textContent alone runs table cells and list items together ("ab" from
// <td>a</td><td>b</td>), so walk the tree and space out block-ish boundaries.
export function extractText(html) {
  if (!html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;
  const out = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out.push(child.nodeValue);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      walk(child);
      if (BREAK_AFTER.test(child.tagName)) out.push(" ");
    }
  };
  walk(container);
  return out.join("").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/* -------------------------------- word diff ------------------------------- */

const tokenize = (text) => (text ? text.split(/\s+/).filter(Boolean) : []);

// Past this table size the LCS isn't worth computing — treat it as a rewrite.
const MAX_LCS_CELLS = 250_000;

// Word-level diff of two texts → [{ type: 'same'|'del'|'ins', text }], with
// adjacent runs of the same type merged.
export function diffWords(beforeText, afterText) {
  const a = tokenize(beforeText);
  const b = tokenize(afterText);

  const parts = [];
  const push = (type, tokens) => {
    if (!tokens.length) return;
    const text = tokens.join(" ");
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += ` ${text}`;
    else parts.push({ type, text });
  };

  // Trim the common prefix/suffix so the LCS table only covers the changed middle.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  push("same", a.slice(0, start));

  if (!midA.length || !midB.length || midA.length * midB.length > MAX_LCS_CELLS) {
    push("del", midA);
    push("ins", midB);
  } else {
    const cols = midB.length + 1;
    const lcs = new Uint32Array((midA.length + 1) * cols);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        lcs[i * cols + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * cols + j + 1] + 1
            : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    let delRun = [];
    let insRun = [];
    const flush = () => {
      push("del", delRun);
      push("ins", insRun);
      delRun = [];
      insRun = [];
    };
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        flush();
        push("same", [midA[i]]);
        i++;
        j++;
      } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
        delRun.push(midA[i++]);
      } else {
        insRun.push(midB[j++]);
      }
    }
    delRun.push(...midA.slice(i));
    insRun.push(...midB.slice(j));
    flush();
  }

  push("same", a.slice(endA));
  return parts;
}

const snippet = (text, words = 7) => {
  const t = tokenize(text);
  return t.length > words ? `${t.slice(0, words).join(" ")}…` : t.join(" ");
};

/* --------------------------- in-document preview -------------------------- */

// The whole document with the selected ops rendered as marks: word-level
// <ins>/<del> inside replaced blocks (via diffHtml, so tables stay tables),
// inserted blocks wrapped in .diff-added, deleted blocks in .diff-removed.
// `deselected` holds indices into `edits` whose ops are previewed as skipped.
// Mirrors applyOpsToHtml's slot semantics so the preview matches what apply
// would produce.
const rootTag = (html) => (String(html).match(/^\s*<\s*([a-zA-Z0-9-]+)/) || [])[1]?.toLowerCase() || "";

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

/* ----------------------------- per-op diff items -------------------------- */

// One reviewable item per operation, diffed against the document the ops were
// generated for. `opRef` points back at the original op so a selection of
// items maps 1:1 onto a subset of ops (a setDocument rewrite has no opRef —
// it's all-or-nothing). Kinds: text | formatting | add | remove | rewrite | new.
export function buildDiffItems(edits = [], beforeHtml = "") {
  const ops = (edits || []).filter((op) => op && typeof op.op === "string");
  const blocks = htmlToBlocks(beforeHtml);
  const blockText = blocks.map(extractText);

  const setDoc = ops.find((op) => op.op === "setDocument");
  if (setDoc) {
    const beforeText = extractText(beforeHtml);
    if (!beforeText) {
      return [{ kind: "new", label: "New document", html: setDoc.html || "", opRef: null }];
    }
    return [
      {
        kind: "rewrite",
        label: "Rewrites the entire document",
        parts: diffWords(beforeText, extractText(setDoc.html || "")),
        opRef: null,
      },
    ];
  }

  return ops.map((op) => {
    // Clamp exactly like applyOpsToHtml so labels match what apply will touch.
    const index = Math.max(0, Math.min(Number(op.index) || 0, Math.max(blocks.length - 1, 0)));
    const anchor = blockText[index] || "";
    switch (op.op) {
      case "replace": {
        const after = extractText(op.html || "");
        if (anchor === after) {
          return { kind: "formatting", label: `Block ${index + 1}`, note: "Formatting only — the text stays the same", html: op.html || "", opRef: op };
        }
        return { kind: "text", label: `Block ${index + 1} · edited`, parts: diffWords(anchor, after), opRef: op };
      }
      case "delete":
        return { kind: "remove", label: `Block ${index + 1} · removed`, html: blocks[index] || "", opRef: op };
      case "insertAfter":
      case "insertBefore":
        return {
          kind: "add",
          label: "Added content",
          sub: anchor ? `${op.op === "insertAfter" ? "after" : "before"} “${snippet(anchor)}”` : null,
          html: op.html || "",
          opRef: op,
        };
      default:
        return { kind: "text", label: op.op, parts: [], opRef: op };
    }
  });
}

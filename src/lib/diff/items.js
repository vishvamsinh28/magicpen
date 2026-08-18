"use client";

import { htmlToBlocks } from "@/components/editor/blocks";
import { extractText } from "./text";
import { diffWords, snippet } from "./words";

/**
 * Per-op reviewable diff items: one entry per proposed operation, diffed
 * against the document the ops were generated for. Formatting-only changes
 * (same text, different markup) are detected and previewed instead of diffed.
 */

/**
 * Build review items for `edits` against `beforeHtml`. `opRef` points back at
 * the original op so a selection of items maps 1:1 onto a subset of ops (a
 * setDocument rewrite has no opRef — it's all-or-nothing). Kinds:
 * text | formatting | add | remove | rewrite | new.
 */
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

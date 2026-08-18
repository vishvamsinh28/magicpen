"use client";

/**
 * Diff entry point: turns proposed edit operations into reviewable diffs.
 * Blocks are compared as plain text with a word-level LCS diff (./diff/words);
 * buildDiffPreviewHtml renders the whole document with changes marked, and
 * buildDiffItems produces one reviewable item per operation. This barrel keeps
 * the `@/lib/diff` import path stable for the chat and editor components.
 */

export { buildDiffPreviewHtml } from "./diff/preview";
export { buildDiffItems } from "./diff/items";

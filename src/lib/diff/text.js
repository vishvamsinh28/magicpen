"use client";

/**
 * Plain-text extraction from HTML for diffing. Browser-only: relies on the
 * DOM to parse markup, so it must never be imported from server code.
 */

const BREAK_AFTER = /^(p|div|li|tr|td|th|h[1-6]|blockquote|pre|figure|figcaption|br|hr)$/i;

/**
 * HTML → normalized plain text. textContent alone runs table cells and list
 * items together ("ab" from <td>a</td><td>b</td>), so walk the tree and space
 * out block-ish boundaries instead.
 */
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

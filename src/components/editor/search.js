"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Find & replace support: match finding over the ProseMirror doc plus a
// decoration plugin that highlights matches. The React panel (FindReplacePanel)
// owns the state and pushes {matches, activeIndex} in via setMeta.

/** Key for the search-highlight plugin; setMeta with it to set the matches. */
export const searchPluginKey = new PluginKey("sdSearch");

/**
 * All occurrences of `query` as [{from, to}] doc ranges. Matches can span
 * styled runs within a block ("bo" + "ld" finds "bold") but never cross block
 * boundaries. Case-insensitive unless `caseSensitive` is set.
 */
export function findMatches(doc, query, caseSensitive = false) {
  if (!query) return [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const results = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;

    // Flatten the block to one string with a char-index → doc-position map.
    let text = "";
    const runs = []; // { start (index in text), pos (doc position), len }
    node.forEach((child, offset) => {
      if (child.isText) {
        runs.push({ start: text.length, pos: pos + 1 + offset, len: child.text.length });
        text += child.text;
      } else {
        // Atom inline (hard break, image) — placeholder chars keep indexes aligned.
        text += "￼".repeat(child.nodeSize);
      }
    });

    const posAt = (index) => {
      for (const run of runs) {
        if (index >= run.start && index < run.start + run.len) return run.pos + (index - run.start);
      }
      return null;
    };

    const haystack = caseSensitive ? text : text.toLowerCase();
    let idx = haystack.indexOf(needle);
    while (idx !== -1) {
      const from = posAt(idx);
      const last = posAt(idx + needle.length - 1);
      if (from != null && last != null) results.push({ from, to: last + 1 });
      idx = haystack.indexOf(needle, idx + 1);
    }
    return false; // block handled — don't descend into its inline content again
  });

  return results;
}

/**
 * Decorates search matches with mp-search-hit (the active one additionally
 * with mp-search-hit-active). Between meta pushes, existing decorations are
 * mapped through document changes so they track edits.
 */
export const SearchHighlight = Extension.create({
  name: "sdSearch",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(searchPluginKey);
            if (meta) {
              const decos = meta.matches.map((m, i) =>
                Decoration.inline(m.from, m.to, {
                  class: i === meta.activeIndex ? "mp-search-hit mp-search-hit-active" : "mp-search-hit",
                })
              );
              return DecorationSet.create(tr.doc, decos);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return searchPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});

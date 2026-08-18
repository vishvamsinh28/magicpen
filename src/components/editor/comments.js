"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Comment anchoring. A thread stores the text it was made against plus the
// character offset it sat at; at render time we look the quote up again and
// highlight the nearest match. Nothing is written into the document, so people
// with comment-only access can annotate, and anchors survive edits made by
// other people instead of conflicting with them.

export const commentsPluginKey = new PluginKey("sdComments");

// Flattens the document to plain text alongside a char-index -> doc-position
// map, so offsets stay meaningful across formatting changes.
export function docTextIndex(doc) {
  let text = "";
  const runs = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    node.forEach((child, offset) => {
      if (child.isText) {
        runs.push({ start: text.length, pos: pos + 1 + offset, len: child.text.length });
        text += child.text;
      } else {
        text += " ".repeat(child.nodeSize);
      }
    });
    text += "\n";
    return false;
  });
  return { text, runs };
}

const posAt = (index, charIndex) => {
  for (const run of index.runs) {
    if (charIndex >= run.start && charIndex < run.start + run.len) {
      return run.pos + (charIndex - run.start);
    }
  }
  return null;
};

// Char offset of a document position — used when a comment is created.
export function offsetOfPos(index, pos) {
  let best = 0;
  for (const run of index.runs) {
    if (pos >= run.pos && pos < run.pos + run.len) return run.start + (pos - run.pos);
    if (run.pos <= pos) best = run.start + run.len;
  }
  return best;
}

// The occurrence of `quote` closest to where the comment was originally made.
export function findQuoteRange(index, quote, anchorStart) {
  if (!quote) return null;
  const needle = quote.trim();
  if (!needle) return null;

  const hits = [];
  let at = index.text.indexOf(needle);
  while (at !== -1 && hits.length < 200) {
    hits.push(at);
    at = index.text.indexOf(needle, at + 1);
  }
  if (!hits.length) return null;

  const target = Number.isFinite(anchorStart) ? anchorStart : 0;
  const start = hits.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const from = posAt(index, start);
  const to = posAt(index, start + needle.length - 1);
  if (from == null || to == null) return null;
  return { from, to: to + 1 };
}

export const CommentHighlights = Extension.create({
  name: "sdComments",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: commentsPluginKey,
        state: {
          init: () => ({ threads: [], activeId: null, deco: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(commentsPluginKey);
            const threads = meta?.threads ?? prev.threads;
            const activeId = meta && "activeId" in meta ? meta.activeId : prev.activeId;
            if (!meta && !tr.docChanged) return prev;

            const index = docTextIndex(tr.doc);
            const decos = [];
            for (const thread of threads) {
              if (thread.resolved) continue;
              const range = findQuoteRange(index, thread.quote, thread.anchorStart);
              if (!range) continue;
              decos.push(
                Decoration.inline(range.from, range.to, {
                  class:
                    thread.threadId === activeId
                      ? "mp-comment-hit mp-comment-hit-active"
                      : "mp-comment-hit",
                  "data-thread": thread.threadId,
                })
              );
            }
            return { threads, activeId, deco: DecorationSet.create(tr.doc, decos) };
          },
        },
        props: {
          decorations(state) {
            return commentsPluginKey.getState(state).deco;
          },
          // Clicking highlighted text selects that thread in the sidebar.
          handleClick(view, pos) {
            const state = commentsPluginKey.getState(view.state);
            if (!state.threads.length) return false;
            const index = docTextIndex(view.state.doc);
            for (const thread of state.threads) {
              if (thread.resolved) continue;
              const range = findQuoteRange(index, thread.quote, thread.anchorStart);
              if (range && pos >= range.from && pos <= range.to) {
                view.dom.dispatchEvent(
                  new CustomEvent("mp-comment-click", { detail: thread.threadId, bubbles: true })
                );
                return false;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

// Push the current thread list / selection into the plugin.
export function setCommentState(editor, { threads, activeId }) {
  if (!editor || editor.isDestroyed || !editor.view) return;
  const tr = editor.state.tr.setMeta(commentsPluginKey, { threads, activeId });
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

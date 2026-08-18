"use client";

import { useEditorState } from "@tiptap/react";

/**
 * Selection-derived state for the toolbar (active marks, block type, attrs,
 * undo/redo availability), recomputed only when the selection or doc changes.
 * Returns null while there is no live editor, so callers must use `s?.` reads.
 */
export function useToolbarState(editor) {
  return useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed || ed.isDestroyed) return null;
      // In collaborative documents undo/redo come from Yjs, and its plugin
      // state isn't available on the very first transactions — asking too
      // early throws, so probe defensively rather than crash the toolbar.
      const probe = (fn) => {
        try {
          return fn();
        } catch {
          return false;
        }
      };
      return {
        bold: ed.isActive("bold"),
        italic: ed.isActive("italic"),
        underline: ed.isActive("underline"),
        strike: ed.isActive("strike"),
        fontFamily: ed.getAttributes("textStyle").fontFamily || null,
        imageSelected: ed.isActive("image"),
        imageWidth: ed.getAttributes("image").width || null,
        fontSize: ed.getAttributes("textStyle").fontSize || null,
        lineHeight:
          ed.getAttributes("paragraph").lineHeight ||
          ed.getAttributes("heading").lineHeight ||
          null,
        color: ed.getAttributes("textStyle").color || null,
        highlight: ed.getAttributes("highlight").color || null,
        inTable: ed.isActive("table"),
        inTaskList: ed.isActive("taskList"),
        inLink: ed.isActive("link"),
        canUndo: probe(() => ed.can().undo()),
        canRedo: probe(() => ed.can().redo()),
        heading: ed.isActive("heading", { level: 1 })
          ? 1
          : ed.isActive("heading", { level: 2 })
            ? 2
            : ed.isActive("heading", { level: 3 })
              ? 3
              : 0,
      };
    },
  });
}

"use client";

import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";

// Paragraph-level line spacing (the toolbar "Spacing" control). With a text
// selection it applies to the selected blocks; with just a cursor it applies
// to the whole document, like a document-wide spacing default.
const BlockSpacing = Extension.create({
  name: "blockSpacing",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockSpacing:
        (value) =>
        ({ tr, state, dispatch }) => {
          const { from, to, empty } = state.selection;
          const start = empty ? 0 : from;
          const end = empty ? state.doc.content.size : to;
          state.doc.nodesBetween(start, end, (node, pos) => {
            if (node.type.name === "paragraph" || node.type.name === "heading") {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

export function createExtensions() {
  return [
    StarterKit.configure({
      link: { openOnClick: false, autolink: true },
    }),
    TextStyle,
    Color,
    FontSize,
    BlockSpacing,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Image.configure({ allowBase64: true }),
    TableKit.configure({
      table: { resizable: true },
    }),
    Placeholder.configure({
      placeholder: "Start writing, paste content, or ask the assistant…",
      showOnlyWhenEditable: true,
    }),
  ];
}

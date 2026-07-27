"use client";

import { Extension, Mark } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontSize, FontFamily } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import Collaboration from "@tiptap/extension-collaboration";
import PageBreak from "./PageBreak";
import { SearchHighlight } from "./search";
import { CommentHighlights } from "./comments";

// The toolbar's image-size options set a width attribute (a percentage), which
// the sanitizer keeps — style-based widths would be stripped on save.
const SizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
    };
  },
});

// Paragraph-level line spacing (the toolbar "Spacing" control). With a text
// selection it applies to the selected blocks; with just a cursor it applies
// to the whole document, like a document-wide spacing default.
const BlockSpacing = Extension.create({
  name: "blockSpacing",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "listItem", "bulletList", "orderedList", "blockquote"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
          // Whole-block text color ("make the letter blue") — without this the
          // schema strips style="color: …" from <p>/<h*> and AI color edits
          // apply invisibly.
          color: {
            default: null,
            parseHTML: (element) => element.style.color || null,
            renderHTML: (attributes) =>
              attributes.color ? { style: `color: ${attributes.color}` } : {},
          },
          // Block-level font size (RTF import emits it on paragraphs).
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
          // Whole-block background ("give the title a yellow background").
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) =>
              attributes.backgroundColor
                ? { style: `background-color: ${attributes.backgroundColor}` }
                : {},
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
          const SPACEABLE = new Set(["paragraph", "heading", "listItem"]);
          state.doc.nodesBetween(start, end, (node, pos) => {
            if (SPACEABLE.has(node.type.name)) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

// A right-floated inline span — "HackerRank <span float:right>Bangalore</span>"
// puts the location flush right on the same line, like resume/letterhead rows.
// Without this mark the editor schema would strip those spans on load.
const TailSpan = Mark.create({
  name: "tailSpan",

  parseHTML() {
    return [{
      tag: "span",
      getAttrs: (element) => (element.style?.float === "right" ? {} : false),
    }];
  },

  renderHTML() {
    return ["span", { style: "float: right" }, 0];
  },
});

// `ydoc` is only passed for documents that are actually being collaborated on.
// Without it the editor behaves exactly as it always has; with it, the document
// state lives in the CRDT and Yjs supplies undo/redo (its history is per-user,
// so undo never rolls back someone else's typing).
export function createExtensions({ ydoc = null } = {}) {
  return [
    StarterKit.configure({
      // autolink would re-linkify plain-text emails/URLs inside float-right
      // tail spans, splitting them into separate floats that wrap badly.
      link: { openOnClick: false, autolink: false },
      ...(ydoc ? { undoRedo: false } : {}),
    }),
    ...(ydoc ? [Collaboration.configure({ document: ydoc })] : []),
    TextStyle,
    Color,
    FontSize,
    FontFamily,
    BlockSpacing,
    TailSpan,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph", "listItem", "blockquote"] }),
    SizableImage.configure({ allowBase64: true }),
    TableKit.configure({
      table: { resizable: true },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    PageBreak,
    SearchHighlight,
    CommentHighlights,
    Placeholder.configure({
      placeholder: "Start writing, paste content, or ask the assistant…",
      showOnlyWhenEditable: true,
    }),
  ];
}

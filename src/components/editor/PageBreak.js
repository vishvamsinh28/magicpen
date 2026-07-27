"use client";

import { Node } from "@tiptap/core";

// Manual page break. Persists as a bare <div style="page-break-after: always">
// (the only attribute the sanitizer keeps), which browsers honor natively when
// the document is printed / saved as PDF. In the editor it renders with a
// data-page-break attribute that globals.css turns into a labeled dashed rule.
const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      {
        tag: "div",
        getAttrs: (element) => {
          const style = element.getAttribute("style") || "";
          return /(?:page-)?break-after:\s*(?:always|page)/i.test(style) ? {} : false;
        },
      },
    ];
  },

  renderHTML() {
    return ["div", { style: "page-break-after: always", "data-page-break": "true" }];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    };
  },
});

export default PageBreak;

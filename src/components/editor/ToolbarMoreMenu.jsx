"use client";

import {
  Heading1, Heading2, Heading3, Pilcrow, List, ListOrdered,
  Quote, Code2, Minus as MinusIcon, Table as TableIcon,
  Link as LinkIcon, Unlink, AlignLeft, AlignCenter, AlignRight,
  RemoveFormatting, Rows3, Columns3, Trash2, ListChecks, SeparatorHorizontal,
} from "lucide-react";

/**
 * Items for the toolbar's "More formatting" dropdown: block types, lists,
 * alignment, links, tables, and clear-formatting. Table rows swap between
 * insert and edit/delete depending on whether the caret sits inside a table.
 *
 * `run` wraps a TipTap chain (focus + run); `onEditLink` opens the link dialog
 * prefilled from the selection; `s` is the useToolbarState snapshot.
 */
export function buildMoreItems({ editor, s, run, onEditLink }) {
  if (!editor) return [];
  return [
    { label: "Paragraph", icon: <Pilcrow size={15} />, active: !s?.heading, onSelect: run((c) => c.setParagraph()) },
    { label: "Heading 1", icon: <Heading1 size={15} />, active: s?.heading === 1, onSelect: run((c) => c.toggleHeading({ level: 1 })) },
    { label: "Heading 2", icon: <Heading2 size={15} />, active: s?.heading === 2, onSelect: run((c) => c.toggleHeading({ level: 2 })) },
    { label: "Heading 3", icon: <Heading3 size={15} />, active: s?.heading === 3, onSelect: run((c) => c.toggleHeading({ level: 3 })) },
    "divider",
    { label: "Bullet list", icon: <List size={15} />, onSelect: run((c) => c.toggleBulletList()) },
    { label: "Numbered list", icon: <ListOrdered size={15} />, onSelect: run((c) => c.toggleOrderedList()) },
    { label: "Checklist", icon: <ListChecks size={15} />, active: s?.inTaskList, onSelect: run((c) => c.toggleTaskList()) },
    { label: "Blockquote", icon: <Quote size={15} />, onSelect: run((c) => c.toggleBlockquote()) },
    { label: "Code block", icon: <Code2 size={15} />, onSelect: run((c) => c.toggleCodeBlock()) },
    { label: "Divider line", icon: <MinusIcon size={15} />, onSelect: run((c) => c.setHorizontalRule()) },
    {
      label: "Page break",
      desc: "Starts a new page when printed or saved as PDF",
      icon: <SeparatorHorizontal size={15} />,
      onSelect: run((c) => c.insertPageBreak()),
    },
    "divider",
    { label: "Align left", icon: <AlignLeft size={15} />, onSelect: run((c) => c.setTextAlign("left")) },
    { label: "Align center", icon: <AlignCenter size={15} />, onSelect: run((c) => c.setTextAlign("center")) },
    { label: "Align right", icon: <AlignRight size={15} />, onSelect: run((c) => c.setTextAlign("right")) },
    "divider",
    {
      label: s?.inLink ? "Edit link" : "Insert link",
      icon: <LinkIcon size={15} />,
      onSelect: onEditLink,
    },
    ...(s?.inLink
      ? [{ label: "Remove link", icon: <Unlink size={15} />, onSelect: run((c) => c.unsetLink()) }]
      : []),
    "divider",
    ...(s?.inTable
      ? [
          { label: "Add row below", icon: <Rows3 size={15} />, onSelect: run((c) => c.addRowAfter()) },
          { label: "Add column right", icon: <Columns3 size={15} />, onSelect: run((c) => c.addColumnAfter()) },
          { label: "Delete table", icon: <Trash2 size={15} />, danger: true, onSelect: run((c) => c.deleteTable()) },
        ]
      : [
          {
            label: "Insert table",
            icon: <TableIcon size={15} />,
            onSelect: run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })),
          },
        ]),
    { label: "Clear formatting", icon: <RemoveFormatting size={15} />, onSelect: run((c) => c.unsetAllMarks().clearNodes()) },
  ];
}

"use client";

import { useState } from "react";
import { useEditorState } from "@tiptap/react";
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough,
  Palette, Highlighter, MoreHorizontal, ChevronDown,
  Heading1, Heading2, Heading3, Pilcrow, List, ListOrdered,
  Quote, Code2, Minus as MinusIcon, Table as TableIcon,
  Link as LinkIcon, Unlink, AlignLeft, AlignCenter, AlignRight,
  RemoveFormatting, Rows3, Columns3, Trash2,
} from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import PromptDialog from "@/components/ui/PromptDialog";

const FONT_SIZES = ["Default", "10", "12", "14", "16", "18", "20", "24", "28", "32"];
const SPACINGS = ["Default", "1.0", "1.15", "1.5", "2.0", "2.5", "3.0"];

const TEXT_COLORS = [
  { label: "Default", value: null },
  { label: "Gray", value: "#6b6a60" },
  { label: "Red", value: "#c53929" },
  { label: "Coral", value: "#e8684a" },
  { label: "Amber", value: "#b45309" },
  { label: "Green", value: "#1e7f4f" },
  { label: "Blue", value: "#1d63d8" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
];

const HIGHLIGHTS = [
  { label: "None", value: null },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Purple", value: "#e9d5ff" },
];

function ToolButton({ onClick, active, disabled, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
        active ? "bg-accent-soft text-accent-deep" : "text-ink hover:bg-cream"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

function LabeledDropdown({ label, value, items }) {
  return (
    <Dropdown
      items={items}
      trigger={
        <button className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink transition-colors hover:bg-cream">
          <span className="text-muted">{label}</span>
          <span className="font-medium">{value}</span>
          <ChevronDown size={13} className="text-muted" />
        </button>
      }
      menuClassName="max-h-72 overflow-y-auto"
    />
  );
}

function Swatches({ title, colors, current, onPick }) {
  return (
    <div className="p-2">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {colors.map((c) => (
          <button
            key={c.label}
            title={c.label}
            onClick={() => onPick(c.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition-transform hover:scale-110 ${
              current === c.value || (!current && !c.value)
                ? "border-accent ring-1 ring-accent"
                : "border-line"
            }`}
            style={{ background: c.value || "#ffffff" }}
          >
            {!c.value && <span className="text-[10px] font-bold text-muted">✕</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Toolbar({ editor }) {
  // null = closed; otherwise the link href being edited ("" for a new link).
  const [linkDraft, setLinkDraft] = useState(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            underline: ed.isActive("underline"),
            strike: ed.isActive("strike"),
            fontSize: ed.getAttributes("textStyle").fontSize || null,
            lineHeight:
              ed.getAttributes("paragraph").lineHeight ||
              ed.getAttributes("heading").lineHeight ||
              null,
            color: ed.getAttributes("textStyle").color || null,
            highlight: ed.getAttributes("highlight").color || null,
            inTable: ed.isActive("table"),
            inLink: ed.isActive("link"),
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
            heading: ed.isActive("heading", { level: 1 })
              ? 1
              : ed.isActive("heading", { level: 2 })
                ? 2
                : ed.isActive("heading", { level: 3 })
                  ? 3
                  : 0,
          }
        : null,
  });

  const run = (fn) => () => editor && fn(editor.chain().focus()).run();

  const moreItems = editor
    ? [
        { label: "Paragraph", icon: <Pilcrow size={15} />, active: !s?.heading, onSelect: run((c) => c.setParagraph()) },
        { label: "Heading 1", icon: <Heading1 size={15} />, active: s?.heading === 1, onSelect: run((c) => c.toggleHeading({ level: 1 })) },
        { label: "Heading 2", icon: <Heading2 size={15} />, active: s?.heading === 2, onSelect: run((c) => c.toggleHeading({ level: 2 })) },
        { label: "Heading 3", icon: <Heading3 size={15} />, active: s?.heading === 3, onSelect: run((c) => c.toggleHeading({ level: 3 })) },
        "divider",
        { label: "Bullet list", icon: <List size={15} />, onSelect: run((c) => c.toggleBulletList()) },
        { label: "Numbered list", icon: <ListOrdered size={15} />, onSelect: run((c) => c.toggleOrderedList()) },
        { label: "Blockquote", icon: <Quote size={15} />, onSelect: run((c) => c.toggleBlockquote()) },
        { label: "Code block", icon: <Code2 size={15} />, onSelect: run((c) => c.toggleCodeBlock()) },
        { label: "Divider line", icon: <MinusIcon size={15} />, onSelect: run((c) => c.setHorizontalRule()) },
        "divider",
        { label: "Align left", icon: <AlignLeft size={15} />, onSelect: run((c) => c.setTextAlign("left")) },
        { label: "Align center", icon: <AlignCenter size={15} />, onSelect: run((c) => c.setTextAlign("center")) },
        { label: "Align right", icon: <AlignRight size={15} />, onSelect: run((c) => c.setTextAlign("right")) },
        "divider",
        {
          label: s?.inLink ? "Edit link" : "Insert link",
          icon: <LinkIcon size={15} />,
          onSelect: () => setLinkDraft(editor.getAttributes("link").href || ""),
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
      ]
    : [];

  return (
    <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto rounded-[5px] border-[1.5px] border-frame bg-paper px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToolButton label="Undo" disabled={!s?.canUndo} onClick={run((c) => c.undo())}>
        <Undo2 size={16} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Redo" disabled={!s?.canRedo} onClick={run((c) => c.redo())}>
        <Redo2 size={16} strokeWidth={2} />
      </ToolButton>

      <div className="mx-1.5 h-5 w-px shrink-0 bg-line" />

      <LabeledDropdown
        label="Size"
        value={s?.fontSize ? s.fontSize.replace("px", "") : "Default"}
        items={FONT_SIZES.map((size) => ({
          label: size,
          active: size === "Default" ? !s?.fontSize : s?.fontSize === `${size}px`,
          onSelect: () =>
            size === "Default"
              ? editor?.chain().focus().unsetFontSize().run()
              : editor?.chain().focus().setFontSize(`${size}px`).run(),
        }))}
      />

      <LabeledDropdown
        label="Spacing"
        value={s?.lineHeight || "Default"}
        items={SPACINGS.map((sp) => ({
          label: sp,
          active: sp === "Default" ? !s?.lineHeight : s?.lineHeight === sp,
          onSelect: () => editor?.commands.setBlockSpacing(sp === "Default" ? null : sp),
        }))}
      />

      <div className="mx-1.5 h-5 w-px shrink-0 bg-line" />

      <ToolButton label="Bold" active={s?.bold} onClick={run((c) => c.toggleBold())}>
        <Bold size={15} strokeWidth={2.6} />
      </ToolButton>
      <ToolButton label="Italic" active={s?.italic} onClick={run((c) => c.toggleItalic())}>
        <Italic size={15} strokeWidth={2.2} />
      </ToolButton>
      <ToolButton label="Underline" active={s?.underline} onClick={run((c) => c.toggleUnderline())}>
        <Underline size={15} strokeWidth={2.2} />
      </ToolButton>
      <ToolButton label="Strikethrough" active={s?.strike} onClick={run((c) => c.toggleStrike())}>
        <Strikethrough size={15} strokeWidth={2.2} />
      </ToolButton>

      <div className="mx-1.5 h-5 w-px shrink-0 bg-line" />

      <Dropdown
        trigger={
          <button title="Text color" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-cream ${s?.color ? "text-accent-deep" : "text-ink"}`}>
            <Palette size={16} strokeWidth={2} />
          </button>
        }
      >
        {(close) => (
          <Swatches
            title="Text color"
            colors={TEXT_COLORS}
            current={s?.color}
            onPick={(v) => {
              close();
              v ? editor?.chain().focus().setColor(v).run() : editor?.chain().focus().unsetColor().run();
            }}
          />
        )}
      </Dropdown>

      <Dropdown
        trigger={
          <button title="Highlight" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-cream ${s?.highlight ? "text-accent-deep" : "text-ink"}`}>
            <Highlighter size={16} strokeWidth={2} />
          </button>
        }
      >
        {(close) => (
          <Swatches
            title="Highlight"
            colors={HIGHLIGHTS}
            current={s?.highlight}
            onPick={(v) => {
              close();
              v
                ? editor?.chain().focus().setHighlight({ color: v }).run()
                : editor?.chain().focus().unsetHighlight().run();
            }}
          />
        )}
      </Dropdown>

      <Dropdown
        align="right"
        trigger={
          <button title="More formatting" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-cream">
            <MoreHorizontal size={16} strokeWidth={2.2} />
          </button>
        }
        items={moreItems}
        menuClassName="max-h-80 overflow-y-auto"
      />

      <PromptDialog
        open={linkDraft !== null}
        title={linkDraft ? "Edit link" : "Insert link"}
        placeholder="https://example.com"
        defaultValue={linkDraft ?? ""}
        confirmLabel="Apply"
        allowEmpty
        onSubmit={(url) => {
          setLinkDraft(null);
          const href = url.trim();
          if (!href) editor?.chain().focus().unsetLink().run();
          else editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
        }}
        onCancel={() => setLinkDraft(null)}
      />
    </div>
  );
}

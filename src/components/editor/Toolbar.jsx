"use client";

import { useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough,
  Palette, Highlighter, MoreHorizontal, ChevronDown,
  Heading1, Heading2, Heading3, Pilcrow, List, ListOrdered,
  Quote, Code2, Minus as MinusIcon, Table as TableIcon,
  Link as LinkIcon, Unlink, AlignLeft, AlignCenter, AlignRight,
  RemoveFormatting, Rows3, Columns3, Trash2,
  Image as ImageIcon, ListChecks, SeparatorHorizontal, Search,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";
import PromptDialog from "@/components/ui/PromptDialog";

const FONT_SIZES = ["Default", "10", "12", "14", "16", "18", "20", "24", "28", "32"];
const SPACINGS = ["Default", "1.0", "1.15", "1.5", "2.0", "2.5", "3.0"];

const FONTS = [
  { label: "Default", value: null },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Garamond", value: "Garamond, 'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

// Display name for whatever font-family string is on the selection.
const fontLabel = (value) => {
  if (!value) return "Default";
  const first = value.split(",")[0].replace(/['"]/g, "").trim();
  return first || "Default";
};

const IMAGE_WIDTHS = [
  { label: "Original", value: null },
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "Full width", value: "100%" },
];

// Read + downscale an image for inline embedding (base64 in the doc). Large
// photos get capped at 1600px wide; PNGs stay PNG so transparency survives.
async function fileToInsertableSrc(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(file);
  });
  if (file.type === "image/gif") return dataUrl; // canvas would lose animation

  const img = await new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That file doesn't look like an image."));
    el.src = dataUrl;
  });
  const MAX_WIDTH = 1600;
  const scale = Math.min(1, MAX_WIDTH / (img.naturalWidth || MAX_WIDTH));
  if (scale === 1 && file.size < 500 * 1024) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.87);
}

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

export default function Toolbar({ editor, findOpen = false, onToggleFind }) {
  const ws = useWorkspace();
  // null = closed; otherwise the link href being edited ("" for a new link).
  const [linkDraft, setLinkDraft] = useState(null);
  const imageInputRef = useRef(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
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
        label="Font"
        value={fontLabel(s?.fontFamily)}
        items={FONTS.map((font) => ({
          label: font.label,
          active: font.value ? fontLabel(s?.fontFamily) === font.label : !s?.fontFamily,
          onSelect: () =>
            font.value
              ? editor?.chain().focus().setFontFamily(font.value).run()
              : editor?.chain().focus().unsetFontFamily().run(),
        }))}
      />

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

      <ToolButton label="Insert image" onClick={() => imageInputRef.current?.click()}>
        <ImageIcon size={16} strokeWidth={2} />
      </ToolButton>

      {s?.imageSelected && (
        <LabeledDropdown
          label="Image"
          value={IMAGE_WIDTHS.find((w) => w.value === s.imageWidth)?.label || s.imageWidth || "Original"}
          items={IMAGE_WIDTHS.map((w) => ({
            label: w.label,
            active: s.imageWidth === w.value || (!s.imageWidth && !w.value),
            onSelect: () => editor?.chain().focus().updateAttributes("image", { width: w.value }).run(),
          }))}
        />
      )}

      <ToolButton label="Find & replace (Ctrl+F)" active={findOpen} onClick={onToggleFind}>
        <Search size={16} strokeWidth={2.1} />
      </ToolButton>

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

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !editor) return;
          if (file.size > 8 * 1024 * 1024) {
            ws.showToast("Images up to 8 MB are supported.");
            return;
          }
          try {
            const src = await fileToInsertableSrc(file);
            editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[a-z0-9]+$/i, "") }).run();
          } catch (err) {
            ws.showToast(err.message || "Couldn't insert that image.");
          }
        }}
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

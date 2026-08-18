"use client";

import { useRef, useState } from "react";
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough,
  MoreHorizontal, Image as ImageIcon, Search,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";
import PromptDialog from "@/components/ui/PromptDialog";
import { FONTS, FONT_SIZES, SPACINGS, IMAGE_WIDTHS, fontLabel } from "./toolbarOptions";
import { ToolButton, LabeledDropdown, ColorControls } from "./ToolbarControls";
import { buildMoreItems } from "./ToolbarMoreMenu";
import { insertImageFile } from "./toolbarImages";
import { useToolbarState } from "./useToolbarState";

// Part of this module's public API (kept through the split); reads and
// downscales an image file into an insertable data URL.
export { fileToInsertableSrc } from "./toolbarImages";

/**
 * Formatting toolbar for the TipTap editor. variant: "pill" floats on a canvas
 * (share page); "inline" renders only the controls, for embedding in the single
 * chrome row next to the menus. `onToggleFind` is optional — the share page
 * renders this toolbar without a find panel to drive, hiding that button.
 */
export default function Toolbar({ editor, findOpen = false, onToggleFind, variant = "pill" }) {
  const ws = useWorkspace();
  // null = closed; otherwise the link href being edited ("" for a new link).
  const [linkDraft, setLinkDraft] = useState(null);
  const imageInputRef = useRef(null);
  const s = useToolbarState(editor);

  const run = (fn) => () => editor && fn(editor.chain().focus()).run();

  const moreItems = buildMoreItems({
    editor,
    s,
    run,
    onEditLink: () => setLinkDraft(editor.getAttributes("link").href || ""),
  });

  return (
    // Docs-style rounded strip sitting on the canvas.
    <div
      className={
        variant === "inline"
          ? "flex shrink-0 items-center gap-0.5"
          : "flex shrink-0 items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-paper px-2.5 py-1 shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
    >
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

      <ColorControls editor={editor} color={s?.color} highlight={s?.highlight} />

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

      {/* The share page renders this toolbar without a find panel to drive. */}
      {onToggleFind && (
        <ToolButton label="Find & replace (Ctrl+F)" active={findOpen} onClick={onToggleFind}>
          <Search size={16} strokeWidth={2.1} />
        </ToolButton>
      )}

      <Dropdown
        align="right"
        trigger={
          <button title="More formatting" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas">
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
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          insertImageFile(editor, file, ws?.showToast);
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

"use client";

import { ChevronDown, Palette, Highlighter } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { TEXT_COLORS, HIGHLIGHTS } from "./toolbarOptions";

/**
 * Small presentational building blocks shared by the toolbar: icon buttons,
 * labeled dropdowns, color swatch grids, and the paired text-color/highlight
 * pickers. Purely visual — every action is passed in by the caller.
 */

/** Round icon button with active/disabled states, sized for the toolbar strip. */
export function ToolButton({ onClick, active, disabled, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
        active ? "bg-accent-soft text-accent-deep" : "text-ink hover:bg-canvas"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

/** "Label: Value ▾" dropdown trigger (Font, Size, Spacing, Image width). */
export function LabeledDropdown({ label, value, items }) {
  return (
    <Dropdown
      items={items}
      trigger={
        <button className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-ink transition-colors hover:bg-canvas">
          <span className="text-muted">{label}</span>
          <span className="font-medium">{value}</span>
          <ChevronDown size={13} className="text-muted" />
        </button>
      }
      menuClassName="max-h-72 overflow-y-auto"
    />
  );
}

/** Color swatch grid; the null swatch renders as ✕ and means "clear". */
export function Swatches({ title, colors, current, onPick }) {
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

/**
 * The text-color and highlight dropdown pair. `color`/`highlight` are the
 * values currently on the selection (from useToolbarState); picking a swatch
 * closes the menu first so the editor command runs with focus restored.
 */
export function ColorControls({ editor, color, highlight }) {
  return (
    <>
      <Dropdown
        trigger={
          <button title="Text color" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-canvas ${color ? "text-accent-deep" : "text-ink"}`}>
            <Palette size={16} strokeWidth={2} />
          </button>
        }
      >
        {(close) => (
          <Swatches
            title="Text color"
            colors={TEXT_COLORS}
            current={color}
            onPick={(v) => {
              close();
              v ? editor?.chain().focus().setColor(v).run() : editor?.chain().focus().unsetColor().run();
            }}
          />
        )}
      </Dropdown>

      <Dropdown
        trigger={
          <button title="Highlight" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-canvas ${highlight ? "text-accent-deep" : "text-ink"}`}>
            <Highlighter size={16} strokeWidth={2} />
          </button>
        }
      >
        {(close) => (
          <Swatches
            title="Highlight"
            colors={HIGHLIGHTS}
            current={highlight}
            onPick={(v) => {
              close();
              v
                ? editor?.chain().focus().setHighlight({ color: v }).run()
                : editor?.chain().focus().unsetHighlight().run();
            }}
          />
        )}
      </Dropdown>
    </>
  );
}

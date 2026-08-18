"use client";

import { Search, X } from "lucide-react";

/**
 * Shared header strip for the right-side panels: icon + title (plus an
 * optional suffix node, e.g. the active document name) and a close button.
 * `gap` reproduces the gap-1 spacing some panels use between title and close.
 */
export function PanelHeader({ icon, title, suffix = null, gap = false, onClose }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between ${
        gap ? "gap-1 " : ""
      }border-b border-line py-2 pl-3 pr-2`}
    >
      <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-ink">
        {icon}
        {title}
        {suffix}
      </span>
      <button
        onClick={onClose}
        title="Close panel"
        aria-label="Close panel"
        className="shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/**
 * Rounded search field used by the list panels. Reports the raw input string
 * through onChange so callers can pass their filter-state setter directly.
 */
export function PanelSearch({ value, onChange, placeholder }) {
  return (
    <div className="shrink-0 px-3 pb-2 pt-2.5">
      <div className="flex items-center gap-2 rounded-full border border-line-strong bg-paper px-3 py-1.5">
        <Search size={14} className="shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        />
      </div>
    </div>
  );
}

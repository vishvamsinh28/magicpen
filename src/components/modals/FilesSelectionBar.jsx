"use client";

import { Trash2 } from "lucide-react";

/**
 * Sticky action bar that replaces the "Recent documents" heading while any
 * cards are selected in the Files modal: selection count plus Select all /
 * Cancel / Delete. Selection state lives in FilesModal; this only renders
 * the controls (Delete opens FilesModal's batch-confirm dialog).
 */
export default function SelectionBar({ count, onSelectAll, onClear, onDelete }) {
  return (
    <div className="sticky top-3 z-20 mt-10 flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 shadow-card">
      <span className="text-[13px] font-semibold text-ink">{count} selected</span>
      <button
        onClick={onSelectAll}
        className="rounded-md px-2 py-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
      >
        Select all
      </button>
      <div className="flex-1" />
      <button
        onClick={onClear}
        className="rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-canvas"
      >
        Cancel
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-card transition-colors hover:bg-red-700"
      >
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  );
}

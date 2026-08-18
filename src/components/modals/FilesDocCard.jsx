"use client";

import { Check, EllipsisVertical, FileText, FolderOpen, Pencil, Trash2 } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { timeAgo } from "@/lib/client-utils";

/**
 * One document tile in the Files-modal grid: content preview (or an icon
 * placeholder), title + last-edited footer, a select checkbox that shows on
 * hover (and stays visible while any card is selected), and a "⋮" menu with
 * Open / Rename / Delete. Purely presentational — FilesModal owns the list
 * state and performs every mutation through the callbacks.
 */
export default function DocCard({ doc, selected, selectMode, onToggleSelect, onOpen, onRename, onDelete }) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-[4px] border bg-paper text-left shadow-card transition-shadow hover:shadow-pop ${
        selected ? "border-accent ring-2 ring-accent/35" : "border-line"
      }`}
    >
      <button
        aria-label={selected ? `Deselect ${doc.title}` : `Select ${doc.title}`}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border-[1.5px] shadow-card transition-opacity ${
          selected
            ? "border-accent bg-accent text-white"
            : `border-line-strong bg-paper text-transparent hover:text-muted ${
                selectMode ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              }`
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <button onClick={onOpen} className="relative flex h-44 flex-col items-stretch justify-start overflow-hidden border-b border-line bg-paper p-3 text-left">
        {doc.previewHtml ? (
          // Safe to inject: previewHtml is sanitized server-side
          // (cleanDocHtml in /api/documents) before it reaches the client.
          <div className="doc-preview" dangerouslySetInnerHTML={{ __html: doc.previewHtml }} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <FileText size={28} strokeWidth={1.4} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-paper to-transparent" />
      </button>
      <div className="flex items-start justify-between gap-2 px-3.5 py-3">
        <button onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-[15px] font-semibold text-ink">{doc.title}</p>
          <p className="mt-0.5 text-[12px] text-muted">{timeAgo(doc.updatedAt)}</p>
        </button>
        <Dropdown
          align="right"
          items={[
            { label: "Open", icon: <FolderOpen size={14} />, onSelect: onOpen },
            { label: "Rename", icon: <Pencil size={14} />, onSelect: onRename },
            "divider",
            { label: "Delete", icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ]}
          trigger={
            <button
              aria-label="Document options"
              className="shrink-0 rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-canvas hover:text-ink focus:opacity-100 group-hover:opacity-100"
            >
              <EllipsisVertical size={16} />
            </button>
          }
        />
      </div>
    </div>
  );
}

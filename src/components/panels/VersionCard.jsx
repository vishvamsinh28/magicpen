"use client";

import {
  GitCommit, Eye, RotateCcw, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { timeAgo } from "@/lib/client-utils";

/**
 * Display title for a commit: its label when set, otherwise a date-based
 * fallback so unnamed commits still read naturally in lists and dialogs.
 */
export const commitTitle = (version) =>
  version.label ||
  `Commit — ${new Date(version.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

/**
 * One commit card in the version history: title with a rename/delete menu,
 * age, and preview / restore actions. Highlighted with the accent border
 * while its snapshot is the one being previewed.
 */
export default function VersionCard({
  version, previewing, onTogglePreview, onRestore, onRename, onDelete,
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-card ${
        previewing ? "border-accent bg-accent-soft/40" : "border-line bg-paper"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-snug text-ink">
          <GitCommit size={13} className="shrink-0 text-accent" />
          <span className="truncate">{commitTitle(version)}</span>
        </p>
        <Dropdown
          align="right"
          items={[
            { label: "Rename", icon: <Pencil size={14} />, onSelect: onRename },
            { label: "Delete", icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ]}
          trigger={
            <button
              aria-label={`Commit options: ${commitTitle(version)}`}
              className="rounded-md p-1 text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <MoreHorizontal size={15} />
            </button>
          }
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[11.5px] text-muted">{timeAgo(version.createdAt)}</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePreview}
            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
          >
            <Eye size={11} />
            {previewing ? "Close preview" : "Preview"}
          </button>
          <button
            onClick={onRestore}
            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
          >
            <RotateCcw size={11} />
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

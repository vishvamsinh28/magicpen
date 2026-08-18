"use client";

import { useState } from "react";
import { Eye, RotateCcw, X, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * Sticky bar shown while a commit is previewed on the page. Compare overlays
 * red/green marks for what restoring this commit would change; Restore asks
 * for confirmation because it replaces anything not committed.
 */
export function VersionBar() {
  const ws = useWorkspace();
  const { versionPreview } = ws;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!versionPreview) return null;

  const when = new Date(versionPreview.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="pointer-events-none sticky top-2.5 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-full border border-line bg-paper py-1.5 pl-4 pr-1.5 shadow-pop">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Eye size={15} />
          <span className="max-w-44 truncate">
            {versionPreview.label ? `“${versionPreview.label}”` : "Commit"}
          </span>
        </span>
        <span className="hidden text-[12px] text-muted sm:inline">{when}</span>
        {versionPreview.compare && (
          <span className="hidden items-center gap-1.5 text-[12px] text-muted md:flex">
            <ins className="rounded-[3px] bg-[#e3f1e8] px-1 text-good no-underline">restored</ins>
            <del className="rounded-[3px] bg-red-50 px-1 text-red-700 decoration-red-400">replaced</del>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <button
            onClick={ws.toggleVersionCompare}
            aria-pressed={versionPreview.compare}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
              versionPreview.compare
                ? "border-accent bg-accent-soft text-accent-deep"
                : "border-line bg-paper text-ink-soft hover:bg-canvas"
            }`}
          >
            Compare
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            <RotateCcw size={12} />
            Restore
          </button>
          <button
            onClick={ws.closeVersionPreview}
            aria-label="Back to current version"
            className="rounded-full border border-line bg-paper p-1.5 text-ink-soft transition-colors hover:bg-canvas"
          >
            <X size={13} />
          </button>
        </span>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={versionPreview.label ? `Restore “${versionPreview.label}”?` : "Restore this commit?"}
        message="The document goes back to this commit. Anything not committed will be replaced — commit the current version first if you want to keep it."
        confirmLabel="Restore"
        danger={false}
        busy={busy}
        onConfirm={async () => {
          if (busy) return;
          setBusy(true);
          // restoreVersion reports its own failures via toast; the finally
          // guarantees the dialog never sticks in the busy state.
          try {
            await ws.restoreVersion();
          } finally {
            setBusy(false);
            setConfirmOpen(false);
          }
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/**
 * Sticky bar shown over the document while proposed changes are previewed on
 * the page. Apply/Dismiss act on the same pending change as the chat card;
 * per-edit selection is disabled for whole-document rewrites (setDocument).
 */
export function ReviewBar() {
  const ws = useWorkspace();
  const { pendingChange, pendingDeselected } = ws;
  const total = pendingChange?.edits?.length ?? 0;
  const selectable = !pendingChange?.edits?.some((op) => op.op === "setDocument");
  const selectedCount = selectable ? total - pendingDeselected.size : total;

  return (
    <div className="pointer-events-none sticky top-2.5 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-full border border-accent bg-paper py-1.5 pl-4 pr-1.5 shadow-pop">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-deep">
          <ShieldCheck size={15} />
          Reviewing changes
        </span>
        <span className="hidden text-[12px] text-muted sm:flex sm:items-center sm:gap-1.5">
          {selectable && total > 1 && `${selectedCount} of ${total} selected · `}
          <ins className="rounded-[3px] bg-[#e3f1e8] px-1 text-good no-underline">added</ins>
          <del className="rounded-[3px] bg-red-50 px-1 text-red-700 decoration-red-400">removed</del>
        </span>
        <span className="flex items-center gap-1.5">
          <button
            onClick={ws.approvePendingChange}
            disabled={!selectedCount}
            className={`rounded-full px-3.5 py-1 text-[12.5px] font-semibold text-white transition-colors ${
              selectedCount ? "bg-accent hover:bg-accent-deep" : "cursor-default bg-accent-disabled"
            }`}
          >
            {selectedCount === total
              ? total === 1
                ? "Apply"
                : "Apply all"
              : `Apply ${selectedCount}`}
          </button>
          <button
            onClick={ws.rejectPendingChange}
            className="rounded-full border border-line bg-paper px-3 py-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
          >
            Dismiss
          </button>
        </span>
      </div>
    </div>
  );
}

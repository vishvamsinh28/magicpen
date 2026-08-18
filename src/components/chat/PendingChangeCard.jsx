"use client";

import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import DiffList from "@/components/DiffView";
import { buildDiffItems } from "@/lib/diff";

/**
 * Review-mode card for a proposed change: a diff of every edit op with per-op
 * checkboxes (when ops map 1:1 to diff items) plus apply / dismiss actions.
 * Selection state lives in workspace context so approval knows what to skip.
 */
export default function PendingChangeCard() {
  const ws = useWorkspace();
  const { pendingChange, pendingDeselected: deselected, docHtmlRef } = ws;

  // Diff against the document the proposal was made for — the same html
  // applyEdits will transform. docHtmlRef (not the editor) is the source of
  // truth: it's current on every keystroke and safe across tab switches.
  const items = useMemo(() => {
    if (!pendingChange) return [];
    const docId = pendingChange.docId ?? null;
    const html = docId ? (docHtmlRef.current.get(docId) ?? "") : "";
    return buildDiffItems(pendingChange.edits, html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChange]);

  if (!pendingChange) return null;

  // A setDocument rewrite has no per-op mapping — it's apply-all or dismiss.
  const selectable = items.length > 0 && items.every((it) => it.opRef);
  const total = items.length;
  const selectedCount = selectable ? total - deselected.size : total;

  return (
    <div className="mp-pop-in rounded-2xl border-[1.5px] border-accent bg-accent-soft p-3.5">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-accent-deep">
        <ShieldCheck size={16} /> Review proposed changes
      </p>
      {pendingChange.summary && (
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{pendingChange.summary}</p>
      )}

      {selectable && total > 1 && (
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-muted">
            {selectedCount} of {total} selected
          </span>
          <button
            onClick={() => ws.setPendingSelectAll(deselected.size > 0, total)}
            className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-accent-deep transition-colors hover:bg-accent-faint"
          >
            {deselected.size ? "Select all" : "Clear all"}
          </button>
        </div>
      )}

      <div className={`${selectable && total > 1 ? "mt-1.5" : "mt-2.5"} max-h-[45vh] overflow-y-auto pr-0.5`}>
        <DiffList items={items} selectable={selectable} deselected={deselected} onToggle={ws.togglePendingEdit} />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={ws.approvePendingChange}
          disabled={!selectedCount}
          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-card transition-colors ${
            selectedCount ? "bg-accent hover:bg-accent-deep" : "cursor-default bg-accent-disabled"
          }`}
        >
          {selectedCount === total
            ? total === 1
              ? "Apply"
              : "Apply all"
            : `Apply ${selectedCount} selected`}
        </button>
        <button
          onClick={ws.rejectPendingChange}
          className="rounded-lg border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-canvas"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

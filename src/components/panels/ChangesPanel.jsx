"use client";

import { useEffect, useMemo, useState } from "react";
import { History, RotateCcw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DiffList from "@/components/DiffView";
import { apiFetch, timeAgo } from "@/lib/client-utils";
import { buildDiffItems } from "@/lib/diff";
import { PanelHeader } from "./PanelChrome";

// Badge palette per change status; unknown statuses fall back to "applied".
const STATUS_STYLES = {
  applied: "bg-[#e8f3ec] text-good",
  rejected: "bg-canvas text-muted",
  restored: "bg-accent-soft text-accent-deep",
  pending: "bg-amber-50 text-amber-700",
};

// The recorded ops replayed against the document as it was before the change —
// the same diff the review card showed at proposal time.
function ChangeDiff({ change }) {
  const items = useMemo(() => buildDiffItems(change.ops, change.beforeHtml), [change]);
  if (!items.length) return null;
  return (
    <div className="mt-2.5 border-t border-line pt-2.5">
      <DiffList items={items} />
    </div>
  );
}

/**
 * Audit trail of AI edits on the active document: each change shows status,
 * an expandable diff, and (when a beforeHtml snapshot exists) a restore
 * action that rolls the document back to the state before that change.
 */
export default function ChangesPanel() {
  const ws = useWorkspace();
  const { activeDoc, activeDocId, changesVersion } = ws;
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmChange, setConfirmChange] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [openDiffId, setOpenDiffId] = useState(null);

  useEffect(() => {
    if (!activeDocId) {
      setChanges([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/changes?documentId=${activeDocId}`)
      .then((data) => !cancelled && setChanges(data.changes || []))
      .catch((e) => {
        if (cancelled) return;
        ws.showToast(e.message);
        setChanges([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, changesVersion]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <PanelHeader
        icon={<History size={15} className="shrink-0" />}
        title="AI changes"
        suffix={activeDoc && <span className="max-w-36 truncate font-normal text-muted">· {activeDoc.title}</span>}
        onClose={ws.closePanel}
      />

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3.5">
        {!activeDocId && (
          <p className="px-1 py-2 text-[13px] leading-relaxed text-muted">
            Open a document to see its edit history. Every AI edit is recorded here so you
            can review it or roll the document back.
          </p>
        )}

        {activeDocId && loading && changes.length === 0 && (
          <p className="flex items-center gap-2 px-1 py-2 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading changes…
          </p>
        )}

        {activeDocId && !loading && changes.length === 0 && (
          <p className="px-1 py-2 text-[13px] leading-relaxed text-muted">
            No changes yet. Ask the assistant to edit this document and every change will
            show up here.
          </p>
        )}

        {changes.map((change) => (
          <div key={change.id} className="rounded-xl border border-line bg-paper p-3 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium leading-snug text-ink">{change.summary}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${STATUS_STYLES[change.status] || STATUS_STYLES.applied}`}>
                {change.status}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[11.5px] text-muted">
                {timeAgo(change.createdAt)}
                {change.ops?.length > 0 && ` · ${change.ops.length} operation${change.ops.length > 1 ? "s" : ""}`}
              </p>
              <div className="flex items-center gap-1.5">
                {change.ops?.length > 0 && change.beforeHtml != null && (
                  <button
                    onClick={() => setOpenDiffId(openDiffId === change.id ? null : change.id)}
                    className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
                  >
                    {openDiffId === change.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    {openDiffId === change.id ? "Hide diff" : "View diff"}
                  </button>
                )}
                {change.status !== "rejected" && change.beforeHtml != null && (
                  <button
                    onClick={() => setConfirmChange(change)}
                    className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
                  >
                    <RotateCcw size={11} />
                    Restore
                  </button>
                )}
              </div>
            </div>
            {openDiffId === change.id && <ChangeDiff change={change} />}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmChange}
        title="Roll back this change?"
        message="The document returns to how it was before this change. Later edits will be undone."
        confirmLabel="Restore"
        danger={false}
        busy={restoring}
        onConfirm={async () => {
          if (restoring) return;
          setRestoring(true);
          await ws.restoreChange(confirmChange);
          setRestoring(false);
          setConfirmChange(null);
        }}
        onCancel={() => setConfirmChange(null)}
      />
    </div>
  );
}

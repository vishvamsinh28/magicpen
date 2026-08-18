import { describeOps } from "@/components/editor/blocks";

/**
 * Review-flow actions for a pending AI change: per-edit include/exclude
 * checkboxes, approving (possibly a subset) and rejecting the proposal.
 * Factory (no hooks) recreated each provider render.
 */
export function createPendingActions({
  pendingChange, setPendingChange, pendingDeselected, setPendingDeselected,
  activeDocId, docHtmlRef, editorApiRef,
  applyEdits, recordChange, markMessage,
}) {
  /** Flips whether edit `i` of the pending change is included in the apply. */
  const togglePendingEdit = (i) =>
    setPendingDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  /** Selects or deselects all `count` edits at once. */
  const setPendingSelectAll = (selectAll, count) =>
    setPendingDeselected(selectAll ? new Set() : new Set(Array.from({ length: count }, (_, i) => i)));

  // Apply the reviewed change, minus whatever the user unchecked.
  const approvePendingChange = async () => {
    if (!pendingChange) return;
    const all = pendingChange.edits || [];
    const edits = all.filter((_, i) => !pendingDeselected.has(i));
    if (!edits.length) return;
    const partial = edits.length < all.length;
    // On a partial apply the AI's summary describes ops that were skipped —
    // relabel from the subset that actually lands.
    const summary = partial
      ? `${[...new Set(describeOps(edits).map((d) => d.label))].join(" · ")} (${edits.length} of ${all.length} edits)`
      : pendingChange.summary;
    const ok = await applyEdits({ ...pendingChange, edits, summary });
    markMessage(pendingChange.messageId, {
      appliedStatus: ok ? (partial ? "partial" : "applied") : "failed",
      appliedInfo: ok && partial ? { applied: edits.length, total: all.length } : null,
    });
    setPendingChange(null);
    setPendingDeselected(new Set());
  };

  // Dismiss the proposal untouched; the rejection is still logged so the
  // Changes panel shows what was declined.
  const rejectPendingChange = async () => {
    if (!pendingChange) return;
    const docId = pendingChange.docId ?? activeDocId;
    if (docId) {
      const current =
        docId === activeDocId
          ? (editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "")
          : (docHtmlRef.current.get(docId) ?? "");
      await recordChange({
        documentId: docId,
        chatId: pendingChange.chatId,
        summary: pendingChange.summary || "AI edit",
        ops: pendingChange.edits,
        beforeHtml: current,
        afterHtml: "",
        status: "rejected",
      });
    }
    markMessage(pendingChange.messageId, { appliedStatus: "rejected" });
    setPendingChange(null);
    setPendingDeselected(new Set());
  };

  return { togglePendingEdit, setPendingSelectAll, approvePendingChange, rejectPendingChange };
}

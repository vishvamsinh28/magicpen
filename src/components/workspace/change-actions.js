import { apiFetch, deriveTitleFromHtml } from "@/lib/client-utils";
import { applyOpsToHtml } from "@/components/editor/blocks";

/**
 * AI-change actions: applying edit ops to a document, logging entries for the
 * Changes panel, and restoring a document to a logged before-state.
 * Factory (no hooks) recreated each provider render.
 */
export function createChangeActions({
  activeDocId, setActiveDocId, setOpenDocs, setDocsVersion, setChangesVersion,
  setMobilePane, docHtmlRef, editorApiRef, addTab, showToast,
}) {
  // Best-effort bookkeeping for the Changes panel — a logging failure must
  // never surface as an error for the edit that succeeded.
  const recordChange = async (payload) => {
    try {
      await apiFetch("/api/changes", { method: "POST", body: JSON.stringify(payload) });
      setChangesVersion((v) => v + 1);
    } catch {
      /* history entry lost; the applied edit itself already landed */
    }
  };

  // `docId` pins the edit to the document it was proposed for — without it the
  // edit lands on whatever tab is active (wrong after a mid-review tab switch).
  const applyEdits = async ({ edits, summary, chatId: sourceChatId, newTitle, docId: targetDocId }) => {
    let docId = targetDocId !== undefined ? targetDocId : activeDocId;
    const onActive = docId === activeDocId;
    const beforeHtml = docId
      ? onActive
        ? (editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "")
        : (docHtmlRef.current.get(docId) ?? "")
      : "";
    if (docId && !onActive && !docHtmlRef.current.has(docId)) {
      showToast("Open that document again to apply this change.");
      return false;
    }
    const afterHtml = applyOpsToHtml(beforeHtml, edits);

    try {
      if (!docId) {
        // No document open: the edit becomes a brand-new document.
        const title = newTitle || deriveTitleFromHtml(afterHtml);
        const { document } = await apiFetch("/api/documents", {
          method: "POST",
          body: JSON.stringify({ title, contentHtml: afterHtml }),
        });
        docId = document.id;
        docHtmlRef.current.set(docId, afterHtml);
        addTab(document);
        setActiveDocId(docId);
      } else {
        let appliedHtml = afterHtml;
        if (onActive) {
          editorApiRef.current?.setContent(afterHtml);
          // What the editor actually renders is the truth — if it matches the
          // original, the "edit" was invisible and we say so instead of lying.
          appliedHtml = editorApiRef.current?.getHTML() ?? afterHtml;
          if (edits.length && appliedHtml === beforeHtml) {
            showToast(
              "Those changes couldn't be applied — the formatting isn't supported. Try phrasing the request differently."
            );
            return false;
          }
        }
        docHtmlRef.current.set(docId, appliedHtml);
        const patch = { contentHtml: appliedHtml };
        if (newTitle) {
          patch.title = newTitle;
          setOpenDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, title: newTitle } : d)));
        }
        await apiFetch(`/api/documents/${docId}`, { method: "PATCH", body: JSON.stringify(patch) });
      }
      setDocsVersion((v) => v + 1);
      if (onActive) setMobilePane("editor");
      await recordChange({
        documentId: docId,
        chatId: sourceChatId || null,
        summary: summary || "AI edit",
        ops: edits,
        beforeHtml,
        afterHtml: onActive ? (editorApiRef.current?.getHTML() ?? afterHtml) : afterHtml,
        status: "applied",
      });
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  /** Reverts the active document to a change's before-state and logs it. */
  const restoreChange = async (change) => {
    const docId = activeDocId;
    if (!docId) return;
    const current = editorApiRef.current?.getHTML() ?? "";
    docHtmlRef.current.set(docId, change.beforeHtml);
    editorApiRef.current?.setContent(change.beforeHtml);
    setDocsVersion((v) => v + 1);
    try {
      await apiFetch(`/api/documents/${docId}`, {
        method: "PATCH",
        body: JSON.stringify({ contentHtml: change.beforeHtml }),
      });
      await recordChange({
        documentId: docId,
        chatId: change.chatId,
        summary: `Restored to before “${change.summary}”`,
        ops: [],
        beforeHtml: current,
        afterHtml: change.beforeHtml,
        status: "restored",
      });
    } catch (e) {
      showToast(e.message);
    }
  };

  return { recordChange, applyEdits, restoreChange };
}

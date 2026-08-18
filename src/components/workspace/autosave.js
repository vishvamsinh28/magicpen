import { apiFetch, deriveTitleFromHtml } from "@/lib/client-utils";
import { isHtmlEmpty } from "@/components/editor/blocks";

/**
 * The autosave pipeline: caches every editor edit and persists it after a
 * 900ms per-document debounce, driving the header's save-state badge. Typing
 * into the empty workspace silently creates a document first. Factory (no
 * hooks) recreated each provider render; receives `addTab` from doc-actions.
 */
export function createAutosave({
  activeDocId, setActiveDocId, docHtmlRef, editorApiRef,
  saveTimersRef, creatingFromTypingRef, setSaveState, addTab, showToast,
}) {
  // Debounced (900ms) per-document autosave; one live timer per docId.
  const scheduleSave = (docId) => {
    const timers = saveTimersRef.current;
    clearTimeout(timers.get(docId));
    setSaveState("pending");
    timers.set(
      docId,
      setTimeout(async () => {
        timers.delete(docId);
        const html = docHtmlRef.current.get(docId);
        if (html == null) return;
        try {
          setSaveState("saving");
          await apiFetch(`/api/documents/${docId}`, {
            method: "PATCH",
            body: JSON.stringify({ contentHtml: html }),
          });
          // Another edit may already be waiting — don't claim "saved" over it.
          setSaveState(timers.size ? "pending" : "saved");
        } catch (e) {
          setSaveState("error");
          showToast(`Autosave failed: ${e.message}`);
        }
      }, 900)
    );
  };

  /** Called by the editor on every user edit; caches html and autosaves. */
  const onEditorUpdate = (html) => {
    const docId = activeDocId;
    if (docId) {
      docHtmlRef.current.set(docId, html);
      scheduleSave(docId);
      return;
    }
    // Typing/pasting into the empty workspace silently creates a document.
    if (!creatingFromTypingRef.current && !isHtmlEmpty(html)) {
      creatingFromTypingRef.current = true;
      (async () => {
        try {
          const { document } = await apiFetch("/api/documents", {
            method: "POST",
            body: JSON.stringify({ title: deriveTitleFromHtml(html), contentHtml: html }),
          });
          // Editor may have more content by now — keep the freshest html.
          const latest = editorApiRef.current?.getHTML() ?? html;
          docHtmlRef.current.set(document.id, latest);
          addTab(document);
          setActiveDocId(document.id);
          scheduleSave(document.id);
        } catch (e) {
          showToast(e.message);
        } finally {
          creatingFromTypingRef.current = false;
        }
      })();
    }
  };

  return { onEditorUpdate };
}

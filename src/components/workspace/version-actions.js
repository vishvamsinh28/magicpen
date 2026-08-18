import { apiFetch } from "@/lib/client-utils";

/**
 * Manual version (commit) actions: committing a snapshot of the active
 * document, previewing/comparing, restoring, renaming and deleting commits.
 * Factory (no hooks) recreated each provider render.
 */
export function createVersionActions({
  activeDocId, docHtmlRef, editorApiRef,
  versionPreview, setVersionPreview, setVersionsVersion, setDocsVersion,
  setMobilePane, pendingChange, showToast,
}) {
  /** Snapshots the active document's current html under an optional label. */
  const commitVersion = async (label) => {
    const docId = activeDocId;
    if (!docId) {
      showToast("Open a document to commit a version.");
      return false;
    }
    const html = editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "";
    try {
      await apiFetch("/api/versions", {
        method: "POST",
        body: JSON.stringify({ documentId: docId, label: label || "", contentHtml: html }),
      });
      setVersionsVersion((v) => v + 1);
      showToast(label ? `Committed “${label}”` : "Version committed", "info");
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  /** Fetches a commit's full html and overlays it on the editor as a preview. */
  const openVersionPreview = async (meta) => {
    try {
      const { version } = await apiFetch(`/api/versions/${meta.id}`);
      setVersionPreview({
        id: version.id,
        label: version.label,
        createdAt: version.createdAt,
        docId: version.documentId,
        html: version.contentHtml || "",
        compare: false,
      });
      setMobilePane("editor");
    } catch (e) {
      showToast(e.message);
    }
  };

  const closeVersionPreview = () => setVersionPreview(null);

  /** Toggles the preview between plain snapshot and diff-vs-current views. */
  const toggleVersionCompare = () =>
    setVersionPreview((p) => (p ? { ...p, compare: !p.compare } : p));

  // Check out a commit: the document becomes that snapshot. History is left
  // untouched — uncommitted work is simply replaced (the confirm dialog warns).
  const restoreVersion = async (v) => {
    let version = v || versionPreview;
    if (!version) return false;
    const docId = version.docId ?? version.documentId;
    if (pendingChange && (pendingChange.docId ?? null) === docId) {
      showToast("Apply or dismiss the pending AI change first.");
      return false;
    }
    try {
      // Panel rows carry only metadata — fetch the html when it's missing.
      let html = version.html;
      if (html == null) {
        const { version: full } = await apiFetch(`/api/versions/${version.id}`);
        html = full.contentHtml || "";
      }
      docHtmlRef.current.set(docId, html);
      if (docId === activeDocId) editorApiRef.current?.setContent(html);
      setDocsVersion((x) => x + 1);
      await apiFetch(`/api/documents/${docId}`, {
        method: "PATCH",
        body: JSON.stringify({ contentHtml: html }),
      });
      showToast(version.label ? `Restored “${version.label}”` : "Version restored", "info");
      setVersionPreview(null);
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  /** Renames a commit, syncing an open preview of it. */
  const renameVersion = async (id, label) => {
    try {
      await apiFetch(`/api/versions/${id}`, { method: "PATCH", body: JSON.stringify({ label }) });
      setVersionsVersion((v) => v + 1);
      setVersionPreview((p) => (p?.id === id ? { ...p, label } : p));
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  /** Deletes a commit, closing any open preview of it. */
  const deleteVersion = async (id) => {
    try {
      await apiFetch(`/api/versions/${id}`, { method: "DELETE" });
      setVersionsVersion((v) => v + 1);
      setVersionPreview((p) => (p?.id === id ? null : p));
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  return {
    commitVersion, openVersionPreview, closeVersionPreview, toggleVersionCompare,
    restoreVersion, renameVersion, deleteVersion,
  };
}

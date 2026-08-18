import { apiFetch } from "@/lib/client-utils";

/** Normalizes an API document into the shape the tab strip renders. */
const tabMeta = (doc) => ({
  id: doc.id,
  title: doc.title,
  sourceFile: doc.sourceFile || null,
  shared: !!doc.shared,
});

/**
 * Document actions: open/create/upload/close/rename/delete tabs. The autosave
 * pipeline lives in autosave.js. Factory (no hooks) recreated each provider
 * render. `addTab` is returned for sibling factories (autosave, applyEdits)
 * but is not part of the public context value.
 */
export function createDocActions({
  activeDocId, setActiveDocId, setOpenDocs, setUploading, setDocsVersion,
  docHtmlRef, setMobilePane, setFilesOpen, setTemplatesOpen, showToast,
}) {
  // Flipping a document into (or out of) collaborative mode; the editor watches
  // this to decide whether to bind to a CRDT.
  const markDocumentShared = (docId, shared) =>
    setOpenDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, shared } : d)));

  const addTab = (doc) =>
    setOpenDocs((prev) => (prev.some((d) => d.id === doc.id) ? prev : [...prev, tabMeta(doc)]));

  /** Opens (fetching on first open) and focuses a document tab. */
  const openDocument = async (id) => {
    try {
      if (!docHtmlRef.current.has(id)) {
        const { document } = await apiFetch(`/api/documents/${id}`);
        docHtmlRef.current.set(id, document.contentHtml || "");
        addTab(document);
      }
      setActiveDocId(id);
      setMobilePane("editor");
      setFilesOpen(false);
    } catch (e) {
      showToast(e.message);
    }
  };

  /** Creates an empty document and focuses it. Returns it, or null on failure. */
  const createBlankDocument = async () => {
    try {
      const { document } = await apiFetch("/api/documents", { method: "POST", body: "{}" });
      docHtmlRef.current.set(document.id, "");
      addTab(document);
      setActiveDocId(document.id);
      setMobilePane("editor");
      setFilesOpen(false);
      setTemplatesOpen(false);
      return document;
    } catch (e) {
      showToast(e.message);
      return null;
    }
  };

  /** Creates a document seeded with a template's title and html. */
  const createDocumentFromTemplate = async (template) => {
    try {
      const { document } = await apiFetch("/api/documents", {
        method: "POST",
        body: JSON.stringify({ title: template.name, contentHtml: template.html }),
      });
      docHtmlRef.current.set(document.id, document.contentHtml || "");
      addTab(document);
      setActiveDocId(document.id);
      setDocsVersion((v) => v + 1);
      setMobilePane("editor");
      setTemplatesOpen(false);
    } catch (e) {
      showToast(e.message);
    }
  };

  // One file per request; a failure toasts without aborting the batch.
  const uploadOneFile = async (file) => {
    try {
      const form = new FormData();
      form.append("file", file);
      const { document, notice } = await apiFetch("/api/upload", { method: "POST", body: form });
      docHtmlRef.current.set(document.id, document.contentHtml || "");
      addTab(document);
      setActiveDocId(document.id);
      setDocsVersion((v) => v + 1);
      if (notice) showToast(notice, "info");
    } catch (e) {
      showToast(e.message);
    }
  };

  /** Imports files sequentially; each opens as a tab, last one wins focus. */
  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) await uploadOneFile(file);
      setMobilePane("editor");
    } finally {
      setUploading(false);
    }
  };

  // Closes a tab; if it was active, focus moves to the nearest neighbor.
  // (Focus is resolved inside the updater so it sees the same `prev` the
  // removal is computed from — a long-standing pattern kept as-is.)
  const closeDocument = (id) => {
    setOpenDocs((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (activeDocId === id) {
        const idx = prev.findIndex((d) => d.id === id);
        const neighbor = next[idx] || next[idx - 1] || null;
        setActiveDocId(neighbor ? neighbor.id : null);
      }
      return next;
    });
  };

  /** Persists a rename and mirrors it on the open tab. Rejects blank titles. */
  const renameDocument = async (id, title) => {
    if (!title?.trim()) return false;
    try {
      await apiFetch(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setOpenDocs((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  /** Deletes server-side, then drops the local cache entry and tab. */
  const deleteDocument = async (id) => {
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      docHtmlRef.current.delete(id);
      closeDocument(id);
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  return {
    markDocumentShared, addTab, openDocument, createBlankDocument,
    createDocumentFromTemplate, uploadFiles, closeDocument, renameDocument, deleteDocument,
  };
}

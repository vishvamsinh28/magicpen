import { downloadBlob } from "@/lib/client-utils";

/**
 * Export actions for the active document. PDF goes through the PrintSheet
 * overlay (browser print dialog); other formats stream a converted file from
 * /api/export. Factory (no hooks) recreated each provider render.
 */
export function createExportActions({
  activeDocId, openDocs, docHtmlRef, editorApiRef, setPrintHtml, showToast,
}) {
  const downloadDocument = async (format = "docx") => {
    const docId = activeDocId;
    if (!docId) return;
    if (format === "pdf") {
      // Rendered by PrintSheet, which triggers window.print() once mounted.
      setPrintHtml(editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "");
      return;
    }
    const activeDoc = openDocs.find((d) => d.id === docId);
    const html = editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "";
    try {
      // Raw fetch (not apiFetch): the success payload is a binary blob.
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: activeDoc?.title || "document", html, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Export failed");
      }
      const blob = await res.blob();
      const ext = { docx: "docx", md: "md", html: "html", txt: "txt" }[format] || format;
      downloadBlob(blob, `${(activeDoc?.title || "document").replace(/[\\/:*?"<>|]+/g, "")}.${ext}`);
    } catch (e) {
      showToast(e.message);
    }
  };

  return { downloadDocument };
}

"use client";

import { useEffect } from "react";
import { flushSync } from "react-dom";
import { useWorkspace } from "./workspace-context";

// Dedicated print layer. On screen it's hidden; when printing, the app shell
// is hidden instead and this sheet flows naturally across as many pages as the
// document needs (the in-app editor lives inside fixed-height scroll
// containers, which browsers clip to a single page when printed directly).
export default function PrintSheet() {
  const ws = useWorkspace();
  const { printHtml, setPrintHtml } = ws;

  // Download → "PDF (print)" sets printHtml; once it's rendered, print.
  useEffect(() => {
    if (printHtml == null) return;

    document.body.classList.add("mp-printing");
    const prevTitle = document.title;
    const docTitle = ws.activeDoc?.title;
    if (docTitle) document.title = docTitle;

    const done = () => setPrintHtml(null);
    window.addEventListener("afterprint", done);
    const timer = setTimeout(() => window.print(), 80);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("mp-printing");
      document.title = prevTitle;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printHtml]);

  // Cmd/Ctrl+P: populate the sheet synchronously before the browser snapshots.
  useEffect(() => {
    const onBeforePrint = () => {
      if (printHtml != null || !ws.activeDocId) return;
      const html =
        ws.editorApiRef.current?.getHTML() ?? ws.docHtmlRef.current.get(ws.activeDocId) ?? "";
      flushSync(() => setPrintHtml(html));
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printHtml, ws.activeDocId]);

  if (printHtml == null) return null;

  return (
    <div className="print-sheet doc-editor">
      <div className="tiptap" dangerouslySetInnerHTML={{ __html: printHtml }} />
    </div>
  );
}

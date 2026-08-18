"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { ListTree } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { useDocEditor } from "./useDocEditor";
import { useOverlayHtml } from "./useOverlayHtml";
import { VersionBar, ReviewBar } from "./PreviewBars";
import FindReplacePanel from "./FindReplacePanel";
import OutlinePanel from "./OutlinePanel";
import WordCountButton from "./WordCountButton";
import ZoomControl from "./ZoomControl";
import { DropZone, UploadingOverlay, DragOverlay } from "./DropZone";

const ACCEPT = ".pdf,.docx,.txt,.rtf,.md,.markdown,.html,.htm";

/**
 * The document surface: hosts the TipTap editor page plus everything layered
 * on it — review/commit preview overlays, find & replace, outline, word count,
 * zoom, and drag-and-drop upload. Document/collab wiring lives in useDocEditor;
 * overlay HTML in useOverlayHtml.
 */
export default function EditorPane() {
  const ws = useWorkspace();
  const { activeDocId, uploading } = ws;
  // Find & replace open/focus state lives in the workspace context so the
  // Edit menu and Ctrl+F drive the same panel.
  const { findOpen, findNonce } = ws;

  const [zoom, setZoom] = useState("fit"); // 'fit' | number (percent)
  const [dragDepth, setDragDepth] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [countMode, setCountMode] = useState("words"); // 'words' | 'chars' | 'charsNoSpaces'
  const fileInputRef = useRef(null);

  const { editor, tick, editorFocused, plainPasteAtRef } = useDocEditor(ws);
  const { reviewing, previewingVersion, overlayHtml, overlayActive } = useOverlayHtml(ws);

  const isEmpty = !editor || editor.isEmpty;
  const showDropzone = !activeDocId && isEmpty && !uploading && !editorFocused && !overlayActive;

  // Ctrl/Cmd+F opens in-document find (browser find is useless inside the
  // scroll container). Typing in inputs elsewhere in the app is left alone.
  const findHandlersRef = useRef({});
  findHandlersRef.current.openFind = ws.openFind;
  findHandlersRef.current.closeFind = ws.closeFind;
  const overlayRef = useRef(false);
  overlayRef.current = overlayActive;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "f") return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (overlayRef.current) return;
      e.preventDefault();
      findHandlersRef.current.openFind?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The find panel and outline make no sense over a diff preview.
  useEffect(() => {
    if (overlayActive) {
      findHandlersRef.current.closeFind?.();
      setOutlineOpen(false);
    }
  }, [overlayActive]);

  const jumpToHeading = (item) => {
    if (!editor) return;
    const dom = editor.view.nodeDOM(item.pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: "smooth", block: "start" });
    editor.chain().focus().setTextSelection(item.pos + 1).run();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragDepth(0);
    if (e.dataTransfer?.files?.length) ws.uploadFiles(e.dataTransfer.files);
  };
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

  const zoomValue = zoom === "fit" ? 100 : zoom;

  return (
    <section
      className="flex h-full min-w-0 flex-1 flex-col"
      onKeyDownCapture={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") {
          plainPasteAtRef.current = Date.now();
        }
      }}
    >
      <div className="relative min-h-0 flex-1">
        <div
          className="h-full overflow-y-auto"
          onDragEnter={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragDepth((d) => d + 1); } }}
          onDragLeave={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragDepth((d) => Math.max(0, d - 1)); } }}
          onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }}
          onDrop={onDrop}
        >
          {previewingVersion ? <VersionBar /> : reviewing && <ReviewBar />}
          <div
            style={{ zoom: zoomValue / 100 }}
            className={`px-3 py-6 md:px-10 md:py-8 ${showDropzone ? "mp-hide-placeholder" : ""}`}
          >
            <div
              className={`doc-editor mx-auto w-[850px] max-w-full rounded-[4px] bg-paper px-7 py-12 shadow-card ring-1 ring-line md:px-[88px] md:py-[76px] ${
                overlayActive ? "" : "cursor-text"
              }`}
              onClick={(e) => {
                if (!overlayActive && e.target === e.currentTarget) editor?.commands.focus("end");
              }}
            >
              {overlayActive && (
                <div className="tiptap diff-doc" dangerouslySetInnerHTML={{ __html: overlayHtml }} />
              )}
              <div className={overlayActive ? "hidden" : undefined}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>

        {editor && findOpen && !overlayActive && (
          <FindReplacePanel editor={editor} focusNonce={findNonce} onClose={ws.closeFind} />
        )}

        {editor && !overlayActive && !showDropzone && (
          <button
            onClick={() => setOutlineOpen((o) => !o)}
            title="Outline"
            aria-label="Toggle outline"
            aria-pressed={outlineOpen}
            className={`absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-line shadow-card transition-colors ${
              outlineOpen ? "bg-accent-soft text-accent-deep" : "bg-paper text-ink-soft hover:bg-canvas"
            }`}
          >
            <ListTree size={16} strokeWidth={2} />
          </button>
        )}
        {editor && outlineOpen && !overlayActive && !showDropzone && (
          <OutlinePanel editor={editor} tick={tick} onNavigate={jumpToHeading} />
        )}

        {editor && !isEmpty && !overlayActive && (
          <WordCountButton
            editor={editor}
            countMode={countMode}
            onCycle={() =>
              setCountMode((m) => (m === "words" ? "chars" : m === "chars" ? "charsNoSpaces" : "words"))
            }
          />
        )}

        {showDropzone && <DropZone onPick={() => fileInputRef.current?.click()} />}
        {uploading && <UploadingOverlay />}
        {dragDepth > 0 && <DragOverlay />}

        <ZoomControl zoom={zoom} onZoomChange={setZoom} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          ws.uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

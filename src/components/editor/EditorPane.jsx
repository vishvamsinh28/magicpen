"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { FileText, Upload, Loader2, Minus, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { createExtensions } from "./extensions";
import Toolbar from "./Toolbar";

const ZOOM_STEPS = [50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];
const ACCEPT = ".pdf,.docx,.txt,.rtf,.md,.markdown,.html,.htm";

export default function EditorPane() {
  const ws = useWorkspace();
  const { activeDocId, docsVersion, docHtmlRef, editorApiRef, uploading } = ws;

  const handlersRef = useRef({});
  handlersRef.current.onEditorUpdate = ws.onEditorUpdate;

  const suppressRef = useRef(false);
  const [zoom, setZoom] = useState("fit"); // 'fit' | number (percent)
  const [dragDepth, setDragDepth] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [, setTick] = useState(0); // re-render on editor create/update for empty checks
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: createExtensions(),
    immediatelyRender: false,
    editorProps: {
      attributes: { spellcheck: "true" },
    },
    onCreate: () => setTick((t) => t + 1),
    onUpdate: ({ editor: ed }) => {
      if (suppressRef.current) return;
      handlersRef.current.onEditorUpdate?.(ed.getHTML());
      setTick((t) => t + 1);
    },
    onFocus: () => setEditorFocused(true),
    onBlur: () => setEditorFocused(false),
  });

  // Bridge the editor to the workspace context.
  useEffect(() => {
    if (!editor) return;
    editorApiRef.current = {
      editor,
      getHTML: () => editor.getHTML(),
      setContent: (html) => {
        suppressRef.current = true;
        editor.commands.setContent(html || "", { emitUpdate: false });
        suppressRef.current = false;
      },
      focus: () => editor.commands.focus(),
    };
    return () => {
      if (editorApiRef.current?.editor === editor) editorApiRef.current = null;
    };
  }, [editor, editorApiRef]);

  // Load content when the active document (or a programmatic rewrite) changes.
  useEffect(() => {
    if (!editor) return;
    const target = activeDocId ? (docHtmlRef.current.get(activeDocId) ?? "") : "";
    if (editor.getHTML() === target) return;
    suppressRef.current = true;
    editor.commands.setContent(target, { emitUpdate: false });
    suppressRef.current = false;
    setTick((t) => t + 1);
  }, [editor, activeDocId, docsVersion, docHtmlRef]);

  const isEmpty = !editor || editor.isEmpty;
  const showDropzone = !activeDocId && isEmpty && !uploading && !editorFocused;

  /* ------------------------------ drag & drop ------------------------------ */

  const onDrop = (e) => {
    e.preventDefault();
    setDragDepth(0);
    if (e.dataTransfer?.files?.length) ws.uploadFiles(e.dataTransfer.files);
  };
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

  /* --------------------------------- zoom ---------------------------------- */

  const zoomValue = zoom === "fit" ? 100 : zoom;
  const stepZoom = (dir) => {
    const current = zoom === "fit" ? 100 : zoom;
    const idx = ZOOM_STEPS.findIndex((z) => z >= current);
    const at = idx === -1 ? ZOOM_STEPS.length - 1 : idx;
    const next = ZOOM_STEPS[Math.min(Math.max(at + dir, 0), ZOOM_STEPS.length - 1)];
    setZoom(next);
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col gap-2.5">
      <Toolbar editor={editor} />

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[5px] border-[1.5px] border-frame bg-parchment">
        <div
          className="h-full overflow-y-auto"
          onDragEnter={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragDepth((d) => d + 1); } }}
          onDragLeave={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragDepth((d) => Math.max(0, d - 1)); } }}
          onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }}
          onDrop={onDrop}
        >
          <div
            style={{ zoom: zoomValue / 100 }}
            className={`px-3 py-6 md:px-10 md:py-9 ${showDropzone ? "sd-hide-placeholder" : ""}`}
          >
            <div
              className="doc-editor mx-auto w-[850px] max-w-full cursor-text rounded-[3px] bg-paper px-7 py-12 shadow-card ring-1 ring-line md:px-[88px] md:py-[76px]"
              onClick={(e) => {
                if (e.target === e.currentTarget) editor?.commands.focus("end");
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {showDropzone && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center rounded-lg border-2 border-dashed border-[#d9d5c7] bg-paper/60 px-8 py-14 text-center backdrop-blur-[1px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper shadow-card ring-1 ring-line">
                <FileText size={26} className="text-ink-soft" strokeWidth={1.8} />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink">Drop your document here</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                You can also click 📎 in the chat to attach,
                <br />
                or paste content directly
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-frame bg-paper px-4 py-2 text-sm font-medium text-ink shadow-card transition-colors hover:bg-cream"
              >
                <Upload size={15} strokeWidth={2} />
                Choose a file
              </button>
              <p className="mt-4 text-xs text-muted">
                Accepted formats: PDF, DOCX, TXT, RTF, MD, HTML · ≤ 30 MB
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-paper px-5 py-3.5 shadow-pop">
              <Loader2 size={18} className="animate-spin text-accent" />
              <span className="text-sm font-medium text-ink">Importing your document…</span>
            </div>
          </div>
        )}

        {dragDepth > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[3px] border-2 border-dashed border-accent bg-accent-soft/80">
            <p className="rounded-lg bg-paper px-4 py-2 text-sm font-semibold text-accent-deep shadow-card">
              Drop to upload
            </p>
          </div>
        )}

        {/* zoom control */}
        <div className="absolute bottom-4 right-4 flex items-center overflow-hidden rounded-md border-[1.5px] border-frame bg-paper shadow-card">
          <button
            onClick={() => stepZoom(-1)}
            aria-label="Zoom out"
            className="px-2.5 py-1.5 text-ink transition-colors hover:bg-cream"
          >
            <Minus size={14} strokeWidth={2.2} />
          </button>
          <button
            onClick={() => setZoom("fit")}
            className="min-w-[52px] px-2 py-1.5 text-center text-[13px] font-semibold text-ink transition-colors hover:bg-cream"
            title="Reset zoom"
          >
            {zoom === "fit" ? "Fit" : `${zoom}%`}
          </button>
          <button
            onClick={() => stepZoom(1)}
            aria-label="Zoom in"
            className="px-2.5 py-1.5 text-ink transition-colors hover:bg-cream"
          >
            <Plus size={14} strokeWidth={2.2} />
          </button>
        </div>
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

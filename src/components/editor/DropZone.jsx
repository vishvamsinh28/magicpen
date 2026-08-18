"use client";

import { FileText, Upload, Loader2 } from "lucide-react";

/**
 * Overlay states for the editor surface: the empty-workspace drop target, the
 * import spinner, and the drag-over veil. All presentational — drag/drop and
 * file-picker events stay with EditorPane, which owns the upload flow.
 */

/** Empty-state card inviting a file drop; `onPick` opens the file picker. */
export function DropZone({ onPick }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center rounded-lg border-2 border-dashed border-line-strong bg-paper/60 px-8 py-14 text-center backdrop-blur-[1px]">
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
          onClick={onPick}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink shadow-card transition-colors hover:bg-canvas"
        >
          <Upload size={15} strokeWidth={2} />
          Choose a file
        </button>
        <p className="mt-4 text-xs text-muted">
          Accepted formats: PDF, DOCX, TXT, RTF, MD, HTML · ≤ 30 MB
        </p>
      </div>
    </div>
  );
}

/** Full-surface veil with a spinner while an upload is being imported. */
export function UploadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/60 backdrop-blur-[1px]">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-paper px-5 py-3.5 shadow-pop">
        <Loader2 size={18} className="animate-spin text-accent" />
        <span className="text-sm font-medium text-ink">Importing your document…</span>
      </div>
    </div>
  );
}

/** Dashed highlight shown while files are dragged over the editor. */
export function DragOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[3px] border-2 border-dashed border-accent bg-accent-soft/80">
      <p className="rounded-lg bg-paper px-4 py-2 text-sm font-semibold text-accent-deep shadow-card">
        Drop to upload
      </p>
    </div>
  );
}

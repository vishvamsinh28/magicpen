"use client";

import { useEffect, useState } from "react";
import { Plus, Check, EllipsisVertical, FileText, Loader2, FolderOpen, Pencil, Trash2, Download } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch, timeAgo } from "@/lib/client-utils";

function DocCard({ doc, selected, selectMode, onToggleSelect, onOpen, onRename, onDelete }) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-[4px] border bg-paper text-left shadow-card transition-shadow hover:shadow-pop ${
        selected ? "border-accent ring-2 ring-accent/35" : "border-line"
      }`}
    >
      <button
        aria-label={selected ? `Deselect ${doc.title}` : `Select ${doc.title}`}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border-[1.5px] shadow-card transition-opacity ${
          selected
            ? "border-accent bg-accent text-white"
            : `border-line-strong bg-paper text-transparent hover:text-muted ${
                selectMode ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              }`
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <button onClick={onOpen} className="relative flex h-44 flex-col items-stretch justify-start overflow-hidden border-b border-line bg-paper p-3 text-left">
        {doc.previewHtml ? (
          <div className="doc-preview" dangerouslySetInnerHTML={{ __html: doc.previewHtml }} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <FileText size={28} strokeWidth={1.4} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-paper to-transparent" />
      </button>
      <div className="flex items-start justify-between gap-2 px-3.5 py-3">
        <button onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-[15px] font-semibold text-ink">{doc.title}</p>
          <p className="mt-0.5 text-[12px] text-muted">{timeAgo(doc.updatedAt)}</p>
        </button>
        <Dropdown
          align="right"
          items={[
            { label: "Open", icon: <FolderOpen size={14} />, onSelect: onOpen },
            { label: "Rename", icon: <Pencil size={14} />, onSelect: onRename },
            "divider",
            { label: "Delete", icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ]}
          trigger={
            <button
              aria-label="Document options"
              className="shrink-0 rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-canvas hover:text-ink focus:opacity-100 group-hover:opacity-100"
            >
              <EllipsisVertical size={16} />
            </button>
          }
        />
      </div>
    </div>
  );
}

export default function FilesModal() {
  const ws = useWorkspace();
  const [docs, setDocs] = useState(null);
  const [confirmDoc, setConfirmDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    if (!ws.filesOpen) return;
    setDocs(null);
    setSelected(new Set());
    setConfirmBatch(false);
    apiFetch("/api/documents")
      .then((data) => setDocs(data.documents))
      .catch((e) => {
        ws.showToast(e.message);
        setDocs([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.filesOpen]);

  const rename = async (title) => {
    const doc = renameTarget;
    const next = title.trim();
    if (!doc || renaming) return;
    if (!next || next === doc.title) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    const ok = await ws.renameDocument(doc.id, next);
    setRenaming(false);
    setRenameTarget(null);
    if (ok) setDocs((prev) => prev?.map((d) => (d.id === doc.id ? { ...d, title: next } : d)));
  };

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const removeSelected = async () => {
    if (batchDeleting || selected.size === 0) return;
    setBatchDeleting(true);
    const ids = [...selected];
    const results = await Promise.all(ids.map((id) => ws.deleteDocument(id)));
    // Keep whatever the server refused to delete both selected and visible.
    const gone = new Set(ids.filter((_, i) => results[i]));
    setBatchDeleting(false);
    setConfirmBatch(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of gone) next.delete(id);
      return next;
    });
    if (gone.size) setDocs((prev) => prev?.filter((d) => !gone.has(d.id)));
  };

  const remove = async () => {
    const doc = confirmDoc;
    if (!doc || deleting) return;
    setDeleting(true);
    const ok = await ws.deleteDocument(doc.id);
    setDeleting(false);
    setConfirmDoc(null);
    // Only drop the card once the server confirmed — otherwise the doc
    // reappeared on the next open and looked undeletable.
    if (ok) setDocs((prev) => prev?.filter((d) => d.id !== doc.id));
  };

  return (
    <Modal open={ws.filesOpen} onClose={() => ws.setFilesOpen(false)} variant="full" labelledBy="files-title">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-12 md:py-10">
        <h1 id="files-title" className="text-[26px] font-bold tracking-tight text-ink md:text-[30px]">
          Your files
        </h1>

        <p className="mt-8 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">
          Start a new document
        </p>
        <div className="mt-3.5">
          <button
            onClick={ws.createBlankDocument}
            className="flex h-56 w-44 flex-col items-center justify-center gap-6 rounded-[4px] border border-line bg-paper shadow-card transition-shadow hover:shadow-pop"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-card">
              <Plus size={22} strokeWidth={2.4} />
            </span>
            <span className="text-[15px] font-semibold text-ink">Blank document</span>
          </button>
        </div>

        {selected.size > 0 ? (
          <div className="sticky top-3 z-20 mt-10 flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 shadow-card">
            <span className="text-[13px] font-semibold text-ink">{selected.size} selected</span>
            <button
              onClick={() => setSelected(new Set((docs || []).map((d) => d.id)))}
              className="rounded-md px-2 py-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
            >
              Select all
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirmBatch(true)}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-card transition-colors hover:bg-red-700"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        ) : (
          <p className="mt-10 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">
            Recent documents
          </p>
        )}

        {docs === null ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin" /> Loading your documents…
          </p>
        ) : docs.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-muted">
            Nothing here yet — upload a file or start a blank document and it will show up here.
          </p>
        ) : (
          <div className="mt-3.5 grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {docs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                selected={selected.has(doc.id)}
                selectMode={selected.size > 0}
                onToggleSelect={() => toggleSelect(doc.id)}
                onOpen={() =>
                  selected.size > 0 ? toggleSelect(doc.id) : ws.openDocument(doc.id)
                }
                onRename={() => setRenameTarget(doc)}
                onDelete={() => setConfirmDoc(doc)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDoc}
        title={`Delete "${confirmDoc?.title}"?`}
        message="This can't be undone."
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDoc(null)}
      />

      <ConfirmDialog
        open={confirmBatch}
        title={`Delete ${selected.size} ${selected.size === 1 ? "document" : "documents"}?`}
        message="This can't be undone."
        busy={batchDeleting}
        onConfirm={removeSelected}
        onCancel={() => setConfirmBatch(false)}
      />

      <PromptDialog
        open={!!renameTarget}
        title="Rename document"
        defaultValue={renameTarget?.title}
        confirmLabel="Rename"
        busy={renaming}
        onSubmit={rename}
        onCancel={() => setRenameTarget(null)}
      />
    </Modal>
  );
}

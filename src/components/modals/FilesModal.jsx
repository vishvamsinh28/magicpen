"use client";

import { useEffect, useState } from "react";
import { Plus, EllipsisVertical, FileText, Loader2, FolderOpen, Pencil, Trash2, Download } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch, timeAgo } from "@/lib/client-utils";

function DocCard({ doc, onOpen, onRename, onDelete }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-[4px] border border-line bg-paper text-left shadow-card transition-shadow hover:shadow-pop">
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
              className="shrink-0 rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-cream hover:text-ink focus:opacity-100 group-hover:opacity-100"
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

  useEffect(() => {
    if (!ws.filesOpen) return;
    setDocs(null);
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

        <p className="mt-10 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">
          Recent documents
        </p>

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
                onOpen={() => ws.openDocument(doc.id)}
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

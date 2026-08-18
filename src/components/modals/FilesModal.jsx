"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import DocCard from "./FilesDocCard";
import SelectionBar from "./FilesSelectionBar";
import { apiFetch } from "@/lib/client-utils";

/**
 * Full-screen "Your files" modal: a blank-document starter plus every saved
 * document as a card grid with open / rename / delete and multi-select batch
 * delete. The list is refetched on each open; cards are only removed or
 * retitled locally after the workspace context confirms the server accepted.
 */
export default function FilesModal() {
  const ws = useWorkspace();
  const [docs, setDocs] = useState(null); // null = loading, [] = loaded empty
  const [confirmDoc, setConfirmDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Refetch on every open (and reset selection) so the grid reflects docs
  // created, renamed or deleted elsewhere since the last look.
  useEffect(() => {
    if (!ws.filesOpen) return;
    setDocs(null);
    setSelected(new Set());
    setConfirmBatch(false);
    apiFetch("/api/documents")
      .then((data) => setDocs(data?.documents ?? []))
      .catch((e) => {
        ws.showToast(e.message);
        setDocs([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.filesOpen]);

  // renameDocument / deleteDocument never reject — they toast failures and
  // resolve to a success boolean — so the awaits below need no try/catch.
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
          <SelectionBar
            count={selected.size}
            onSelectAll={() => setSelected(new Set((docs || []).map((d) => d.id)))}
            onClear={() => setSelected(new Set())}
            onDelete={() => setConfirmBatch(true)}
          />
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

"use client";

import { useEffect, useState } from "react";
import { GitCommit, Loader2, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import { apiFetch } from "@/lib/client-utils";
import { PanelHeader } from "./PanelChrome";
import VersionCard, { commitTitle } from "./VersionCard";

/**
 * Version history for the active document: commit-on-purpose snapshots with
 * preview, restore, rename, and delete. Reloads whenever the active document
 * or versionsVersion (bumped by context after a new commit) changes; a shared
 * `busy` flag serializes the restore / delete / rename dialogs.
 */
export default function VersionsPanel() {
  const ws = useWorkspace();
  const { activeDoc, activeDocId, versionsVersion, versionPreview } = ws;
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null); // version meta
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeDocId) {
      setVersions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/versions?documentId=${activeDocId}`)
      .then((data) => !cancelled && setVersions(data.versions || []))
      .catch((e) => {
        if (cancelled) return;
        ws.showToast(e.message);
        setVersions([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, versionsVersion]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <PanelHeader
        icon={<GitCommit size={15} className="shrink-0" />}
        title="Version history"
        suffix={activeDoc && <span className="max-w-32 truncate font-normal text-muted">· {activeDoc.title}</span>}
        onClose={ws.closePanel}
      />

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3.5">
        {!activeDocId && (
          <p className="px-1 py-2 text-[13px] leading-relaxed text-muted">
            Open a document to see its commits. A commit is a snapshot you save on
            purpose — you can always bring the document back to it.
          </p>
        )}

        {activeDocId && (
          <button
            onClick={() => ws.setCommitOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line px-3 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
          >
            <Plus size={15} strokeWidth={2.2} />
            Commit current version
          </button>
        )}

        {activeDocId && loading && versions.length === 0 && (
          <p className="flex items-center gap-2 px-1 py-2 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading commits…
          </p>
        )}

        {activeDocId && !loading && versions.length === 0 && (
          <p className="px-1 py-2 text-[13px] leading-relaxed text-muted">
            No commits yet. When the document is in a state you like, commit it —
            keep editing freely and you can come back to any commit later.
          </p>
        )}

        {versions.map((version) => (
          <VersionCard
            key={version.id}
            version={version}
            previewing={versionPreview?.id === version.id}
            onTogglePreview={() =>
              versionPreview?.id === version.id
                ? ws.closeVersionPreview()
                : ws.openVersionPreview(version)
            }
            onRestore={() => setConfirmRestore(version)}
            onRename={() => setRenaming(version)}
            onDelete={() => setConfirmDelete(version)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmRestore}
        title={confirmRestore ? `Restore “${commitTitle(confirmRestore)}”?` : ""}
        message="The document goes back to this commit. Anything not committed will be replaced — commit the current version first if you want to keep it."
        confirmLabel="Restore"
        danger={false}
        busy={busy}
        onConfirm={async () => {
          if (busy) return;
          setBusy(true);
          await ws.restoreVersion(confirmRestore);
          setBusy(false);
          setConfirmRestore(null);
        }}
        onCancel={() => setConfirmRestore(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete ? `Delete “${commitTitle(confirmDelete)}”?` : ""}
        message="The commit is removed from history. The document itself is not affected."
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={async () => {
          if (busy) return;
          setBusy(true);
          await ws.deleteVersion(confirmDelete.id);
          setBusy(false);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <PromptDialog
        open={!!renaming}
        title="Rename commit"
        placeholder="e.g. Final intro draft"
        defaultValue={renaming?.label || ""}
        confirmLabel="Rename"
        busy={busy}
        onSubmit={async (value) => {
          if (busy) return;
          setBusy(true);
          const ok = await ws.renameVersion(renaming.id, value.trim());
          setBusy(false);
          if (ok) setRenaming(null);
        }}
        onCancel={() => setRenaming(null)}
      />
    </div>
  );
}

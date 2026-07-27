"use client";

import { useEffect, useState } from "react";
import {
  GitCommit, MessageSquare, Loader2, Eye, RotateCcw, MoreHorizontal, Pencil, Trash2, Plus,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch, timeAgo } from "@/lib/client-utils";

const commitTitle = (version) =>
  version.label ||
  `Commit — ${new Date(version.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

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
      .catch(() => !cancelled && setVersions([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeDocId, versionsVersion]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <div className="flex shrink-0 items-center justify-between rounded-[5px] border-[1.5px] border-frame bg-paper py-1 pl-3 pr-2">
        <span className="flex items-center gap-2 py-1.5 text-[13.5px] font-semibold text-ink">
          <GitCommit size={15} />
          Commits
          {activeDoc && <span className="max-w-32 truncate font-normal text-muted">· {activeDoc.title}</span>}
        </span>
        <button
          onClick={() => ws.setLeftView("chat")}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-cream"
        >
          <MessageSquare size={13} />
          Back to chat
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto rounded-[5px] border-[1.5px] border-frame bg-paper px-3 py-3.5">
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
          <div
            key={version.id}
            className={`rounded-xl border p-3 shadow-card ${
              versionPreview?.id === version.id ? "border-accent bg-accent-soft/40" : "border-line bg-paper"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-snug text-ink">
                <GitCommit size={13} className="shrink-0 text-accent" />
                <span className="truncate">{commitTitle(version)}</span>
              </p>
              <Dropdown
                align="right"
                items={[
                  { label: "Rename", icon: <Pencil size={14} />, onSelect: () => setRenaming(version) },
                  { label: "Delete", icon: <Trash2 size={14} />, danger: true, onSelect: () => setConfirmDelete(version) },
                ]}
                trigger={
                  <button
                    aria-label={`Commit options: ${commitTitle(version)}`}
                    className="rounded-md p-1 text-muted transition-colors hover:bg-cream hover:text-ink"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                }
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[11.5px] text-muted">{timeAgo(version.createdAt)}</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    versionPreview?.id === version.id
                      ? ws.closeVersionPreview()
                      : ws.openVersionPreview(version)
                  }
                  className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-cream"
                >
                  <Eye size={11} />
                  {versionPreview?.id === version.id ? "Close preview" : "Preview"}
                </button>
                <button
                  onClick={() => setConfirmRestore(version)}
                  className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-cream"
                >
                  <RotateCcw size={11} />
                  Restore
                </button>
              </div>
            </div>
          </div>
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

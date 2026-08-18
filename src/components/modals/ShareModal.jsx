"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2, Users } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Modal from "@/components/ui/Modal";
import Dropdown from "@/components/ui/Dropdown";
import ShareRow, { ROLE_META } from "./ShareRow";
import { apiFetch } from "@/lib/client-utils";

/**
 * Share dialog for the active document: creates tokenized /d/<token> links
 * with a role (view / comment / edit) and manages existing ones. Role and
 * download changes apply optimistically with an error toast on failure (no
 * rollback — the list resyncs on next open); revoke waits for the server.
 * Creating the first link / revoking the last one flips the document's
 * `shared` flag so the header button reads "Shared".
 */
export default function ShareModal() {
  const ws = useWorkspace();
  const { shareOpen, activeDoc, activeDocId } = ws;
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState("view");

  // Load the document's links each time the modal opens; `cancelled` keeps a
  // stale response from clobbering state after close or doc switch.
  useEffect(() => {
    if (!shareOpen || !activeDocId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/shares?documentId=${activeDocId}`)
      .then((data) => !cancelled && setShares(data?.shares || []))
      .catch(() => !cancelled && setShares([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [shareOpen, activeDocId]);

  const create = async () => {
    if (!activeDocId || creating) return;
    setCreating(true);
    try {
      const data = await apiFetch("/api/shares", {
        method: "POST",
        body: JSON.stringify({ documentId: activeDocId, role: newRole }),
      });
      const share = data?.share;
      if (!share) throw new Error("Server returned no share link");
      setShares((prev) => [share, ...prev]);
      ws.markDocumentShared(activeDocId, true);
    } catch (e) {
      ws.showToast(e.message);
    } finally {
      setCreating(false);
    }
  };

  // Optimistic: the row flips immediately, then the PATCH persists it. A
  // failure only toasts — the next open refetches and corrects the row.
  const patch = async (share, changes) => {
    setShares((prev) => prev.map((s) => (s.id === share.id ? { ...s, ...changes } : s)));
    try {
      await apiFetch(`/api/shares/${share.id}`, { method: "PATCH", body: JSON.stringify(changes) });
    } catch (e) {
      ws.showToast(e.message);
    }
  };

  // Not optimistic: the row only disappears once the server confirms, so a
  // failed revoke can't hide a link that still works.
  const revoke = async (share) => {
    try {
      await apiFetch(`/api/shares/${share.id}`, { method: "DELETE" });
      const left = shares.filter((s) => s.id !== share.id);
      setShares(left);
      if (!left.length) ws.markDocumentShared(activeDocId, false);
    } catch (e) {
      ws.showToast(e.message);
    }
  };

  return (
    <Modal open={shareOpen} onClose={() => ws.setShareOpen(false)} labelledBy="share-title">
      <div className="p-5">
        <p id="share-title" className="flex items-center gap-2 text-[17px] font-bold text-ink">
          <Users size={18} />
          Share document
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {activeDoc ? (
            <>
              Anyone with a link can open <strong className="text-ink-soft">{activeDoc.title}</strong> —
              no account needed.
            </>
          ) : (
            "Open a document to share it."
          )}
        </p>

        {activeDocId && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line bg-canvas p-3">
            <span className="text-[13px] font-medium text-ink">Create a link that lets people</span>
            <Dropdown
              items={Object.entries(ROLE_META).map(([key, meta]) => ({
                label: meta.label,
                desc: meta.desc,
                icon: meta.icon,
                active: newRole === key,
                onSelect: () => setNewRole(key),
              }))}
              trigger={
                <button className="flex items-center gap-1.5 rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas">
                  {ROLE_META[newRole].icon}
                  {ROLE_META[newRole].label}
                </button>
              }
            />
            <button
              onClick={create}
              disabled={creating}
              className="ml-auto flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep disabled:opacity-60"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Create link
            </button>
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          {loading && (
            <p className="flex items-center gap-2 py-2 text-[13px] text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading links…
            </p>
          )}
          {!loading && activeDocId && shares.length === 0 && (
            <p className="py-2 text-[13px] leading-relaxed text-muted">
              No links yet. Create one above — you can change what it allows, or revoke it, at any time.
            </p>
          )}
          {shares.map((share) => (
            <ShareRow
              key={share.id}
              share={share}
              onChange={(changes) => patch(share, changes)}
              onRevoke={() => revoke(share)}
            />
          ))}
        </div>

        {shares.length > 0 && (
          <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
            Editors work on the document at the same time as you — changes merge live. Revoking a
            link cuts off access immediately.
          </p>
        )}
      </div>
    </Modal>
  );
}

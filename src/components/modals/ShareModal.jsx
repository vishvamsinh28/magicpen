"use client";

import { useEffect, useState } from "react";
import {
  Link2, Loader2, Copy, Check, Trash2, Eye, MessageSquare, Pencil, Download, Users,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Modal from "@/components/ui/Modal";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch, timeAgo } from "@/lib/client-utils";

const ROLE_META = {
  view: { label: "Can view", icon: <Eye size={14} />, desc: "Read the document only" },
  comment: { label: "Can comment", icon: <MessageSquare size={14} />, desc: "Read and leave comments" },
  edit: { label: "Can edit", icon: <Pencil size={14} />, desc: "Edit the document together, live" },
};

function ShareRow({ share, onChange, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/d/${share.token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard can be blocked (insecure origin, denied permission) — fall
      // back to a selectable prompt rather than silently doing nothing.
      window.prompt("Copy this link", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-xl border border-line bg-paper p-3 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-deep">
          <Link2 size={14} />
        </span>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-md border border-line bg-cream px-2 py-1.5 text-[12px] text-ink-soft outline-none"
        />
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-md border-[1.5px] border-frame bg-paper px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-cream"
        >
          {copied ? <Check size={13} className="text-good" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Dropdown
          items={Object.entries(ROLE_META).map(([key, meta]) => ({
            label: meta.label,
            desc: meta.desc,
            icon: meta.icon,
            active: share.role === key,
            onSelect: () => onChange({ role: key }),
          }))}
          trigger={
            <button className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:bg-cream">
              {ROLE_META[share.role]?.icon}
              {ROLE_META[share.role]?.label || share.role}
            </button>
          }
        />

        <button
          onClick={() => onChange({ allowDownload: !share.allowDownload })}
          aria-pressed={share.allowDownload}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${
            share.allowDownload
              ? "border-accent-faint bg-accent-soft text-accent-deep"
              : "border-line text-muted hover:bg-cream"
          }`}
        >
          <Download size={13} />
          {share.allowDownload ? "Download on" : "Download off"}
        </button>

        <span className="text-[11.5px] text-muted">Created {timeAgo(share.createdAt)}</span>

        <button
          onClick={async () => {
            setBusy(true);
            await onRevoke();
            setBusy(false);
          }}
          disabled={busy}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Revoke
        </button>
      </div>
    </div>
  );
}

export default function ShareModal() {
  const ws = useWorkspace();
  const { shareOpen, activeDoc, activeDocId } = ws;
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState("view");

  useEffect(() => {
    if (!shareOpen || !activeDocId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/shares?documentId=${activeDocId}`)
      .then((data) => !cancelled && setShares(data.shares || []))
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
      const { share } = await apiFetch("/api/shares", {
        method: "POST",
        body: JSON.stringify({ documentId: activeDocId, role: newRole }),
      });
      setShares((prev) => [share, ...prev]);
      ws.markDocumentShared(activeDocId, true);
    } catch (e) {
      ws.showToast(e.message);
    } finally {
      setCreating(false);
    }
  };

  const patch = async (share, changes) => {
    setShares((prev) => prev.map((s) => (s.id === share.id ? { ...s, ...changes } : s)));
    try {
      await apiFetch(`/api/shares/${share.id}`, { method: "PATCH", body: JSON.stringify(changes) });
    } catch (e) {
      ws.showToast(e.message);
    }
  };

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
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line bg-cream p-3">
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
                <button className="flex items-center gap-1.5 rounded-md border-[1.5px] border-frame bg-paper px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-cream">
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

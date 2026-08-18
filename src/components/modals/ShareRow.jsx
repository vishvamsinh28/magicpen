"use client";

import { useState } from "react";
import {
  Link2, Loader2, Copy, Check, Trash2, Eye, MessageSquare, Pencil, Download,
} from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { timeAgo } from "@/lib/client-utils";

/**
 * Access levels a share link can grant, keyed by the wire `role` value.
 * Used by ShareModal's "create link" picker and by each row's role dropdown —
 * keys must stay in sync with the ROLES the /api/shares route accepts.
 */
export const ROLE_META = {
  view: { label: "Can view", icon: <Eye size={14} />, desc: "Read the document only" },
  comment: { label: "Can comment", icon: <MessageSquare size={14} />, desc: "Read and leave comments" },
  edit: { label: "Can edit", icon: <Pencil size={14} />, desc: "Edit the document together, live" },
};

/**
 * One live share link in the Share modal: the /d/<token> URL with a copy
 * button, a role picker, a download toggle and revoke. Presentational —
 * onChange/onRevoke persist through ShareModal (role and download changes
 * apply optimistically there; only Revoke shows a busy spinner here while it
 * waits for the server).
 */
export default function ShareRow({ share, onChange, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  // Guarded for SSR: window only exists in the browser render.
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
          className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] text-ink-soft outline-none"
        />
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas"
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
            <button className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:bg-canvas">
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
              : "border-line text-muted hover:bg-canvas"
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

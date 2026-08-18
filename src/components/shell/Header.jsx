"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check, Loader2, TriangleAlert, Users, UserRound,
  Settings, LogOut, Pencil, Plus, X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { LogoMark } from "@/components/Logo";
import Dropdown from "@/components/ui/Dropdown";
import PresenceBar from "@/components/collab/PresenceBar";

// Every open document as a tab, browser-style: click to switch, × to close,
// and an always-visible pencil on the active tab so renaming is discoverable
// (the pencil or the active tab's label starts an inline edit).
function DocTabs() {
  const ws = useWorkspace();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const activeTabRef = useRef(null);

  // Keep the active tab in view when the strip overflows (narrow screens).
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [ws.activeDocId]);

  const startRename = (doc) => {
    setEditingId(doc.id);
    setDraft(doc.title);
  };
  const commit = () => {
    const doc = ws.openDocs.find((d) => d.id === editingId);
    const next = draft.trim();
    if (doc && next && next !== doc.title) ws.renameDocument(doc.id, next);
    setEditingId(null);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ws.openDocs.length === 0 && (
        <span className="font-display px-1 text-[19px] font-bold tracking-tight text-ink">
          MagicPen
        </span>
      )}
      {ws.openDocs.map((doc) => {
        const active = doc.id === ws.activeDocId;
        const editing = editingId === doc.id;
        return (
          <div
            key={doc.id}
            ref={active ? activeTabRef : undefined}
            className={`group flex h-9 max-w-[210px] shrink-0 items-center gap-1 rounded-lg px-2.5 transition-colors ${
              active ? "bg-accent-soft text-accent-deep" : "text-ink-soft hover:bg-canvas"
            }`}
          >
            {editing ? (
              <input
                autoFocus
                value={draft}
                aria-label="Document name"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-36 bg-transparent text-[13px] font-medium text-ink outline-none"
              />
            ) : (
              <>
                <button
                  onClick={() => (active ? startRename(doc) : ws.openDocument(doc.id))}
                  title={active ? "Rename" : doc.sourceFile?.name || doc.title}
                  className="min-w-0 truncate text-[13px] font-medium"
                >
                  {doc.sourceFile?.name || doc.title}
                </button>
                {active && (
                  <button
                    onClick={() => startRename(doc)}
                    aria-label={`Rename ${doc.title}`}
                    title="Rename"
                    className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:bg-accent-faint hover:opacity-100"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    ws.closeDocument(doc.id);
                  }}
                  aria-label={`Close ${doc.title}`}
                  className={`shrink-0 rounded p-0.5 transition-opacity ${
                    active
                      ? "opacity-70 hover:bg-accent-faint hover:opacity-100"
                      : "opacity-0 hover:bg-line focus-visible:opacity-100 group-hover:opacity-100"
                  }`}
                >
                  <X size={12.5} />
                </button>
              </>
            )}
          </div>
        );
      })}
      <button
        onClick={ws.createBlankDocument}
        aria-label="New document"
        title="New document"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
      >
        <Plus size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}

// "Saving… / Saved" indicator next to the title, driven by the autosave
// lifecycle in the workspace context.
function SaveIndicator() {
  const ws = useWorkspace();
  if (!ws.activeDocId) return null;
  const state = ws.saveState;
  if (state === "idle") return null;
  const map = {
    pending: { icon: <Loader2 size={12} className="animate-spin" />, label: "Saving…" },
    saving: { icon: <Loader2 size={12} className="animate-spin" />, label: "Saving…" },
    saved: { icon: <Check size={12} />, label: "Saved" },
    error: { icon: <TriangleAlert size={12} className="text-red-600" />, label: "Not saved" },
  };
  const s = map[state];
  if (!s) return null;
  return (
    <span className="hidden shrink-0 items-center gap-1 px-1 text-[11.5px] text-muted sm:flex">
      {s.icon}
      {s.label}
    </span>
  );
}

function AccountMenu() {
  const ws = useWorkspace();
  const { user } = ws;
  const initials = (() => {
    const src = user?.name || user?.email || "?";
    const parts = src.trim().split(/\s+/);
    return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
  })();

  return (
    <Dropdown
      align="right"
      items={[
        { heading: user?.name || user?.email || "Account" },
        { label: "Profile", icon: <UserRound size={14} />, onSelect: () => ws.setInfoModal("profile") },
        { label: "Settings", icon: <Settings size={14} />, onSelect: () => ws.setInfoModal("settings") },
        "divider",
        { label: "Sign out", icon: <LogOut size={14} />, onSelect: ws.signOut },
      ]}
      trigger={
        <button
          aria-label="Account"
          title={user?.email}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[12.5px] font-bold text-white shadow-card transition-opacity hover:opacity-90"
        >
          {initials}
        </button>
      }
    />
  );
}

// Top bar: brand mark, then every open document as a tab (switch, rename,
// close, plus new), save state, then comments / share / account on the right.
// The document library lives in the right rail's Documents panel.
export default function Header() {
  const ws = useWorkspace();
  const hasDoc = !!ws.activeDocId;

  return (
    <header className="flex shrink-0 items-center gap-2 bg-paper px-3 py-2 md:px-4">
      <span className="shrink-0 p-1" aria-hidden>
        <LogoMark size={34} />
      </span>

      <DocTabs />
      <SaveIndicator />

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <PresenceBar peers={ws.peers} selfId={ws.user?.id} />

        <button
          disabled={!hasDoc}
          onClick={() => ws.setShareOpen(true)}
          title="Share this document with a link"
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-semibold transition-colors md:px-4 ${
            hasDoc
              ? "bg-accent-faint text-accent-deep hover:bg-accent-disabled/60"
              : "cursor-not-allowed bg-canvas text-muted"
          }`}
        >
          <Users size={15} strokeWidth={2.2} />
          <span className="hidden md:inline">{ws.activeDoc?.shared ? "Shared" : "Share"}</span>
        </button>

        <AccountMenu />
      </div>
    </header>
  );
}

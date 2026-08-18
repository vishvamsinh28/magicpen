"use client";

import {
  Check, Loader2, TriangleAlert, Users, UserRound, Settings, LogOut,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { LogoMark } from "@/components/Logo";
import Dropdown from "@/components/ui/Dropdown";
import PresenceBar from "@/components/collab/PresenceBar";
import DocTabs from "./DocTabs";

// "Saving… / Saved" chip next to the tabs, driven by the autosave lifecycle
// in the workspace context ('idle'|'pending'|'saving'|'saved'|'error').
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

// Avatar bubble opening the account menu (profile, settings, sign out).
// Initials are the first letters of the first two words of the display name,
// falling back to the email, then "?" when neither exists yet.
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

/**
 * Top workspace bar: brand mark, every open document as a tab (switch,
 * rename, close, plus new — see DocTabs), autosave state, then presence /
 * share / account on the right. The document library itself lives in the
 * right rail's Documents panel, not here. Share is disabled with no doc open.
 */
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

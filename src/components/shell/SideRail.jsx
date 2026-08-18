"use client";

import { Sparkles, MessageSquare, MessageSquareText, GitCommit, History, FolderOpen } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";

// Panels the rail can toggle, in display order. `view` keys must match what
// workspace-context's togglePanel/panel understand.
const VIEWS = [
  { view: "docs", label: "Documents", icon: FolderOpen },
  { view: "chat", label: "AI assistant", icon: Sparkles },
  { view: "history", label: "Chat history", icon: MessageSquare },
  { view: "comments", label: "Comments", icon: MessageSquareText },
  { view: "versions", label: "Version history", icon: GitCommit },
  { view: "changes", label: "AI changes", icon: History },
];

// Styled hover tooltip to the left of the icon (shows on keyboard focus too).
// Slight show delay so sweeping the cursor down the rail doesn't flash every
// label; hiding is immediate.
function RailTooltip({ label }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute right-full top-1/2 z-50 mr-2.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-hover:delay-150 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

/**
 * Slim rail on the right edge, like the Docs side-panel launcher. Each icon
 * toggles a view in the collapsible side panel between the canvas and the
 * rail; the canvas takes the space back when the panel closes. This is the
 * ONLY launcher for these panels (there is no menu bar), so on mobile it
 * shows beside the panel whenever the assistant pane is active.
 */
export default function SideRail() {
  const ws = useWorkspace();

  return (
    <nav
      aria-label="Side panels"
      className={`${
        ws.mobilePane === "chat" ? "flex" : "hidden"
      } w-[52px] shrink-0 flex-col items-center gap-2 border-l border-line bg-paper pt-3 lg:flex`}
    >
      {VIEWS.map(({ view, label, icon: Icon }) => {
        const active = ws.panel === view;
        return (
          <button
            key={view}
            onClick={() => ws.togglePanel(view)}
            aria-label={label}
            aria-pressed={active}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              view === "chat" && !active
                ? "text-accent hover:bg-accent-soft"
                : active
                  ? "bg-accent-soft text-accent-deep"
                  : "text-ink-soft hover:bg-canvas hover:text-ink"
            }`}
          >
            <Icon size={19} strokeWidth={1.9} />
            <RailTooltip label={label} />
          </button>
        );
      })}
    </nav>
  );
}

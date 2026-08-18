"use client";

import { useState } from "react";
import { FileText, Sparkles, TriangleAlert } from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";
import PrintSheet from "./PrintSheet";
import Header from "./shell/Header";
import SideRail from "./shell/SideRail";
import ChatPanel from "./chat/ChatPanel";
import ChangesPanel from "./panels/ChangesPanel";
import VersionsPanel from "./panels/VersionsPanel";
import CommentsPanel from "./panels/CommentsPanel";
import DocumentsPanel from "./panels/DocumentsPanel";
import HistoryPanel from "./panels/HistoryPanel";
import ShareModal from "./modals/ShareModal";
import EditorPane from "./editor/EditorPane";
import Toolbar from "./editor/Toolbar";
import FilesModal from "./modals/FilesModal";
import TemplatesModal from "./modals/TemplatesModal";
import InfoModals from "./modals/InfoModals";
import PromptDialog from "./ui/PromptDialog";

// Mobile-only segmented control under the menu bar (desktop shows the panel
// beside the document instead).
function MobilePaneSwitcher() {
  const ws = useWorkspace();
  const tab = (pane, icon, label, onClick) => (
    <button
      onClick={onClick}
      aria-pressed={ws.mobilePane === pane}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        ws.mobilePane === pane ? "bg-paper text-ink shadow-card" : "text-ink-soft"
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="border-b border-line bg-paper px-3 pb-2 lg:hidden">
      <div className="flex gap-1 rounded-full bg-canvas p-1">
        {tab("editor", <FileText size={14} />, "Document", () => ws.setMobilePane("editor"))}
        {tab("chat", <Sparkles size={14} />, "Assistant", () => {
          // Land on whichever panel view is open; default to the AI chat.
          if (!ws.panel) ws.openPanel("chat");
          else ws.setMobilePane("chat");
        })}
      </div>
    </div>
  );
}

// The chrome row is just the formatting toolbar now — there is no menu bar;
// document management lives in the right rail's panels. Hidden on mobile
// while the assistant pane is active, dimmed while a version preview or
// review diff overlays the editor, mirroring EditorPane.
function ChromeRow() {
  const ws = useWorkspace();
  if (!ws.editorInstance) return null;
  const overlayActive =
    (!!ws.versionPreview && ws.versionPreview.docId === ws.activeDocId) ||
    (!!ws.pendingChange && (ws.pendingChange.docId ?? null) === (ws.activeDocId ?? null));
  return (
    <div
      className={`${
        ws.mobilePane === "editor" ? "flex" : "hidden lg:flex"
      } shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line bg-paper px-2 py-1 md:px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        overlayActive ? "pointer-events-none opacity-60" : ""
      }`}
      aria-disabled={overlayActive}
    >
      <Toolbar
        editor={ws.editorInstance}
        findOpen={ws.findOpen}
        onToggleFind={ws.toggleFind}
        variant="inline"
      />
    </div>
  );
}

// The collapsible side panel between the canvas and the rail.
function SidePanel() {
  const ws = useWorkspace();
  const view = ws.panel ?? "chat";
  if (view === "docs") return <DocumentsPanel />;
  if (view === "history") return <HistoryPanel />;
  if (view === "comments") return <CommentsPanel />;
  if (view === "versions") return <VersionsPanel />;
  if (view === "changes") return <ChangesPanel />;
  return <ChatPanel />;
}

// One dialog serves every "Commit version" entry point (menu, panel).
// commitVersion never throws (it toasts and returns false), so no try/catch.
function CommitDialog() {
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <PromptDialog
      open={ws.commitOpen}
      title="Commit this version"
      placeholder="What's in this version? (optional)"
      confirmLabel="Commit"
      allowEmpty
      busy={busy}
      onSubmit={async (value) => {
        if (busy) return;
        setBusy(true);
        const ok = await ws.commitVersion(value.trim());
        setBusy(false);
        if (ok) ws.setCommitOpen(false);
      }}
      onCancel={() => ws.setCommitOpen(false)}
    />
  );
}

function Toast() {
  const ws = useWorkspace();
  if (!ws.toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4">
      <div className="mp-pop-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-[13px] leading-snug text-white shadow-pop">
        {ws.toast.type === "error" && <TriangleAlert size={15} className="mt-0.5 shrink-0 text-[#8ab4f8]" />}
        <span>{ws.toast.message}</span>
      </div>
    </div>
  );
}

function Shell() {
  const ws = useWorkspace();
  return (
    <div className="app-root flex h-dvh flex-col bg-canvas-deep">
      <Header />
      <ChromeRow />
      <MobilePaneSwitcher />
      <div className="flex min-h-0 flex-1">
        <main
          className={`${
            ws.mobilePane === "editor" ? "flex" : "hidden"
          } h-full min-w-0 flex-1 lg:flex`}
        >
          <EditorPane />
        </main>
        <aside
          className={`${
            ws.mobilePane === "chat" ? "flex" : "hidden"
          } h-full w-full min-w-0 flex-col border-line bg-paper lg:w-[360px] lg:shrink-0 lg:border-l ${
            ws.panel ? "lg:flex" : "lg:hidden"
          }`}
        >
          <SidePanel />
        </aside>
        <SideRail />
      </div>

      <FilesModal />
      <TemplatesModal />
      <InfoModals />
      <ShareModal />
      <CommitDialog />
      <Toast />
    </div>
  );
}

/**
 * The signed-in MagicPen app: mounts the single WorkspaceProvider and lays
 * out the shell (header, toolbar row, editor, side panel, rail, modals).
 * `user` must already be resolved (AppGate) — nothing here handles auth.
 */
export default function Workspace({ user }) {
  return (
    <WorkspaceProvider user={user}>
      <Shell />
      <PrintSheet />
    </WorkspaceProvider>
  );
}

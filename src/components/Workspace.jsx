"use client";

import { MessageSquare, FileText, TriangleAlert } from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";
import PrintSheet from "./PrintSheet";
import Header from "./shell/Header";
import IconRail from "./shell/IconRail";
import NavDrawer from "./shell/NavDrawer";
import ChatPanel from "./chat/ChatPanel";
import ChangesPanel from "./panels/ChangesPanel";
import EditorPane from "./editor/EditorPane";
import FilesModal from "./modals/FilesModal";
import TemplatesModal from "./modals/TemplatesModal";
import ChatHistoryDrawer from "./modals/ChatHistoryDrawer";
import InfoModals from "./modals/InfoModals";

// Mobile-only segmented control under the header (desktop shows both panes
// side by side). Styled like the header's document tabs.
function MobilePaneSwitcher() {
  const ws = useWorkspace();
  const tab = (pane, icon, label) => (
    <button
      onClick={() => ws.setMobilePane(pane)}
      aria-pressed={ws.mobilePane === pane}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-4 py-2 text-[13px] font-semibold transition-colors ${
        ws.mobilePane === pane ? "bg-ink text-white shadow-card" : "text-ink-soft hover:bg-cream"
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="px-3 pb-2.5 lg:hidden">
      <div className="flex gap-1 rounded-lg border-[1.5px] border-frame bg-paper p-1">
        {tab("chat", <MessageSquare size={14} />, "Chat")}
        {tab("editor", <FileText size={14} />, "Editor")}
      </div>
    </div>
  );
}

function Toast() {
  const ws = useWorkspace();
  if (!ws.toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4">
      <div className="sd-pop-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-frame bg-ink px-4 py-3 text-[13px] leading-snug text-white shadow-pop">
        {ws.toast.type === "error" && <TriangleAlert size={15} className="mt-0.5 shrink-0 text-accent" />}
        <span>{ws.toast.message}</span>
      </div>
    </div>
  );
}

function Shell() {
  const ws = useWorkspace();
  return (
    <div className="app-root flex h-dvh flex-col bg-cream">
      <Header />
      <MobilePaneSwitcher />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <main className="flex min-h-0 min-w-0 flex-1 gap-3 px-3 pb-3 md:px-5 md:pb-4 lg:pl-1">
          <div
            className={`${
              ws.mobilePane === "chat" ? "flex" : "hidden"
            } h-full w-full min-w-0 flex-col lg:flex lg:w-[372px] lg:shrink-0`}
          >
            {ws.leftView === "chat" ? <ChatPanel /> : <ChangesPanel />}
          </div>
          <div
            className={`${
              ws.mobilePane === "editor" ? "flex" : "hidden"
            } h-full w-full min-w-0 flex-1 lg:flex`}
          >
            <EditorPane />
          </div>
        </main>
      </div>

      <NavDrawer />
      <FilesModal />
      <TemplatesModal />
      <ChatHistoryDrawer />
      <InfoModals />
      <Toast />
    </div>
  );
}

export default function Workspace({ user }) {
  return (
    <WorkspaceProvider user={user}>
      <Shell />
      <PrintSheet />
    </WorkspaceProvider>
  );
}

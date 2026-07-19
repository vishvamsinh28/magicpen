"use client";

import {
  Plus, FolderOpen, MessageSquare, FileText, History, Sparkles,
  CircleHelp, BookOpen, Bug, Settings, UserRound, X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";

function DrawerItem({ icon, label, onClick, accent = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${
        accent ? "text-accent hover:bg-accent-soft" : "text-ink hover:bg-cream"
      }`}
    >
      <span className={accent ? "text-accent" : "text-ink-soft"}>{icon}</span>
      {label}
    </button>
  );
}

export default function NavDrawer() {
  const ws = useWorkspace();
  if (!ws.navOpen) return null;

  const go = (fn) => () => {
    ws.setNavOpen(false);
    fn();
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-ink/15" onClick={() => ws.setNavOpen(false)} />
      <div className="sd-slide-in-left absolute bottom-0 left-0 top-0 flex w-[320px] max-w-[86vw] flex-col border-r border-line bg-paper px-4 pb-5 pt-4 shadow-pop">
        <div className="mb-4 flex items-center justify-between px-1">
          <span className="text-[19px] font-bold tracking-tight text-ink">SuperDocs</span>
          <button
            onClick={() => ws.setNavOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-cream hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-0.5">
          <button
            onClick={go(ws.newConversation)}
            className="flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-ink transition-colors hover:bg-cream"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
              <Plus size={15} strokeWidth={2.6} />
            </span>
            New chat
          </button>
          <DrawerItem icon={<FolderOpen size={19} strokeWidth={1.9} />} label="Files" onClick={go(() => ws.setFilesOpen(true))} />
          <DrawerItem icon={<MessageSquare size={19} strokeWidth={1.9} />} label="Chats" onClick={go(() => ws.setHistoryOpen(true))} />
          <DrawerItem icon={<FileText size={19} strokeWidth={1.9} />} label="Templates" onClick={go(() => ws.setTemplatesOpen(true))} />
          <DrawerItem
            icon={<History size={19} strokeWidth={1.9} />}
            label="Changes"
            onClick={go(() => {
              ws.setLeftView("changes");
              ws.setMobilePane("chat");
            })}
          />
        </div>

        <div className="flex-1" />

        <div className="space-y-0.5 border-t border-line pt-3">
          <DrawerItem accent icon={<Sparkles size={19} strokeWidth={1.9} />} label="Upgrade" onClick={go(() => ws.setInfoModal("upgrade"))} />
          <DrawerItem icon={<CircleHelp size={19} strokeWidth={1.9} />} label="Get started" onClick={go(() => ws.setInfoModal("getstarted"))} />
          <DrawerItem icon={<BookOpen size={19} strokeWidth={1.9} />} label="Docs" onClick={go(() => ws.setInfoModal("docs"))} />
          <DrawerItem icon={<Bug size={19} strokeWidth={1.9} />} label="Report a bug" onClick={go(() => ws.setInfoModal("bug"))} />
          <DrawerItem icon={<Settings size={19} strokeWidth={1.9} />} label="Settings" onClick={go(() => ws.setInfoModal("settings"))} />
          <DrawerItem icon={<UserRound size={19} strokeWidth={1.9} />} label="Profile" onClick={go(() => ws.setInfoModal("profile"))} />
        </div>
      </div>
    </div>
  );
}

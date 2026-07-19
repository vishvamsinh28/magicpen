"use client";

import {
  PanelLeft, Plus, FolderOpen, MessageSquare, FileText, History,
  Sparkles, CircleHelp, BookOpen, Bug, Settings, UserRound,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";

function RailButton({ label, onClick, children, accent = false, active = false }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
        accent
          ? "text-accent hover:bg-accent-soft"
          : active
            ? "bg-accent-soft text-accent-deep"
            : "text-ink-soft hover:bg-[#f1efe8] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function IconRail() {
  const ws = useWorkspace();

  return (
    <nav className="hidden w-14 shrink-0 flex-col items-center gap-1.5 pb-3 pt-1 lg:flex">
      <RailButton label="Menu" onClick={() => ws.setNavOpen(true)}>
        <PanelLeft size={19} strokeWidth={1.9} />
      </RailButton>

      <button
        onClick={ws.newConversation}
        title="New chat"
        aria-label="New chat"
        className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-card transition-colors hover:bg-accent-deep"
      >
        <Plus size={19} strokeWidth={2.4} />
      </button>

      <div className="mt-1 flex flex-col gap-1.5">
        <RailButton label="Files" onClick={() => ws.setFilesOpen(true)}>
          <FolderOpen size={19} strokeWidth={1.9} />
        </RailButton>
        <RailButton label="Chats" onClick={() => ws.setHistoryOpen(true)}>
          <MessageSquare size={19} strokeWidth={1.9} />
        </RailButton>
        <RailButton label="Templates" onClick={() => ws.setTemplatesOpen(true)}>
          <FileText size={19} strokeWidth={1.9} />
        </RailButton>
        <RailButton
          label="Changes"
          active={ws.leftView === "changes"}
          onClick={() => ws.setLeftView(ws.leftView === "changes" ? "chat" : "changes")}
        >
          <History size={19} strokeWidth={1.9} />
        </RailButton>
      </div>

      <div className="flex-1" />

      <RailButton label="Upgrade" accent onClick={() => ws.setInfoModal("upgrade")}>
        <Sparkles size={19} strokeWidth={1.9} />
      </RailButton>
      <RailButton label="Get started" onClick={() => ws.setInfoModal("getstarted")}>
        <CircleHelp size={19} strokeWidth={1.9} />
      </RailButton>
      <RailButton label="Docs" onClick={() => ws.setInfoModal("docs")}>
        <BookOpen size={19} strokeWidth={1.9} />
      </RailButton>
      <RailButton label="Report a bug" onClick={() => ws.setInfoModal("bug")}>
        <Bug size={19} strokeWidth={1.9} />
      </RailButton>
      <RailButton label="Settings" onClick={() => ws.setInfoModal("settings")}>
        <Settings size={19} strokeWidth={1.9} />
      </RailButton>
      <RailButton label="Profile" onClick={() => ws.setInfoModal("profile")}>
        <UserRound size={19} strokeWidth={1.9} />
      </RailButton>
    </nav>
  );
}

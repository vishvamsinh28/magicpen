"use client";

import { useRef } from "react";
import {
  Plus, Upload, Download, ChevronDown, X, FileText, Menu, Loader2,
  FileType2, FileCode2, FileDown, Printer, GitCommit, Users,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Logo from "@/components/Logo";
import Dropdown from "@/components/ui/Dropdown";
import PresenceBar from "@/components/collab/PresenceBar";

const ACCEPT = ".pdf,.docx,.txt,.rtf,.md,.markdown,.html,.htm";

function DocTabs() {
  const ws = useWorkspace();
  if (!ws.openDocs.length) return null;
  return (
    <div className="hidden min-w-0 flex-1 items-center rounded-[5px] border-[1.5px] border-frame bg-paper p-1 md:flex">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ws.openDocs.map((doc, i) => {
          const active = doc.id === ws.activeDocId;
          return (
            <div
              key={doc.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={() => ws.openDocument(doc.id)}
              onKeyDown={(e) => e.key === "Enter" && ws.openDocument(doc.id)}
              className={`group flex max-w-56 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors ${
                active ? "bg-ink text-white" : "text-ink-soft hover:bg-cream"
              }`}
            >
              <span className={`text-[10.5px] ${active ? "text-white/60" : "text-muted"}`}>{i + 1}</span>
              <FileText size={13} className={active ? "text-white/80" : "text-muted"} />
              <span className="truncate font-medium">
                {doc.sourceFile?.name || doc.title}
              </span>
              <button
                aria-label={`Close ${doc.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  ws.closeDocument(doc.id);
                }}
                className={`-mr-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${
                  active ? "hover:bg-white/20" : "hover:bg-line"
                }`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Header() {
  const ws = useWorkspace();
  const fileRef = useRef(null);
  const hasDoc = !!ws.activeDocId;

  return (
    <header className="flex shrink-0 items-center gap-3 px-3 py-2.5 md:px-5 md:py-3">
      <button
        onClick={() => ws.setNavOpen(true)}
        aria-label="Open menu"
        className="rounded-lg border border-line bg-paper p-2 text-ink lg:hidden"
      >
        <Menu size={17} />
      </button>

      <button onClick={() => ws.setNavOpen(true)} className="hidden shrink-0 lg:block" aria-label="Open menu">
        <Logo />
      </button>
      <span className="shrink-0 lg:hidden">
        <Logo compact />
      </span>

      <DocTabs />

      {/* mobile: active doc name */}
      <span className="min-w-0 flex-1 truncate text-center text-[12.5px] font-medium text-ink-soft md:hidden">
        {ws.activeDoc ? ws.activeDoc.sourceFile?.name || ws.activeDoc.title : ""}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <PresenceBar peers={ws.peers} selfId={ws.user?.id} />

        <button
          disabled={!hasDoc}
          onClick={() => ws.setShareOpen(true)}
          title="Share this document with a link"
          className={`flex items-center gap-2 rounded-lg border-[1.5px] px-2 py-2 text-[13.5px] font-semibold transition-colors md:px-3.5 md:py-2 ${
            ws.activeDoc?.shared
              ? "border-accent bg-accent-soft text-accent-deep hover:bg-accent-faint"
              : "border-frame bg-paper text-ink hover:bg-cream"
          } ${hasDoc ? "" : "cursor-not-allowed opacity-45"}`}
        >
          <Users size={16} strokeWidth={2.2} />
          <span className="hidden md:inline">{ws.activeDoc?.shared ? "Shared" : "Share"}</span>
        </button>

        <button
          onClick={ws.createBlankDocument}
          title="New blank document"
          aria-label="New blank document"
          className="rounded-lg border-[1.5px] border-frame bg-paper p-2 text-ink transition-colors hover:bg-cream md:p-2.5"
        >
          <Plus size={16} strokeWidth={2.2} />
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          title="Upload a document"
          className="flex items-center gap-2 rounded-lg border-[1.5px] border-frame bg-paper px-2 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-cream md:px-3.5 md:py-2"
        >
          {ws.uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} strokeWidth={2.2} />}
          <span className="hidden md:inline">Upload</span>
        </button>

        <button
          disabled={!hasDoc}
          onClick={() => ws.setCommitOpen(true)}
          title="Commit this version — a snapshot you can always come back to"
          className={`flex items-center gap-2 rounded-lg border-[1.5px] border-frame bg-paper px-2 py-2 text-[13.5px] font-semibold text-ink transition-colors md:px-3.5 md:py-2 ${
            hasDoc ? "hover:bg-cream" : "cursor-not-allowed opacity-45"
          }`}
        >
          <GitCommit size={16} strokeWidth={2.2} />
          <span className="hidden md:inline">Commit</span>
        </button>

        <div
          className={`flex items-stretch overflow-hidden rounded-lg text-white shadow-card transition-colors ${
            hasDoc ? "bg-accent" : "cursor-not-allowed bg-accent-disabled"
          }`}
        >
          <button
            disabled={!hasDoc}
            onClick={() => ws.downloadDocument("docx")}
            className={`flex items-center gap-2 py-2 pl-2.5 pr-2 text-[13.5px] font-semibold md:pl-3.5 ${
              hasDoc ? "hover:bg-accent-deep" : ""
            }`}
          >
            <Download size={16} strokeWidth={2.2} />
            <span className="hidden md:inline">Download</span>
            <span className="hidden font-normal text-white/75 md:inline">· Word</span>
          </button>
          <Dropdown
            align="right"
            items={[
              { label: "Word (.docx)", icon: <FileType2 size={14} />, onSelect: () => ws.downloadDocument("docx") },
              {
                label: "PDF (print)",
                desc: "Choose 'Save as PDF' and turn off headers & footers",
                icon: <Printer size={14} />,
                onSelect: () => ws.downloadDocument("pdf"),
              },
              { label: "Markdown (.md)", icon: <FileDown size={14} />, onSelect: () => ws.downloadDocument("md") },
              { label: "HTML (.html)", icon: <FileCode2 size={14} />, onSelect: () => ws.downloadDocument("html") },
              { label: "Plain text (.txt)", icon: <FileText size={14} />, onSelect: () => ws.downloadDocument("txt") },
            ]}
            trigger={
              <button
                disabled={!hasDoc}
                aria-label="Choose download format"
                className={`border-l border-white/25 px-1.5 ${hasDoc ? "hover:bg-accent-deep" : ""}`}
              >
                <ChevronDown size={15} />
              </button>
            }
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          ws.uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </header>
  );
}

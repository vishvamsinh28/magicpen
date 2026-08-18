"use client";

import { useEffect, useRef, useState } from "react";
import {
  FolderOpen, FileText, Search, X, Loader2, LayoutGrid, Plus, LayoutTemplate,
  Upload, FileDown, Printer, FileType2, FileCode2, ChevronDown,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch, timeAgo } from "@/lib/client-utils";

const ACCEPT = ".pdf,.docx,.txt,.rtf,.md,.markdown,.html,.htm";

function ActionChip({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-line bg-paper px-2 py-2 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-accent-faint hover:bg-accent-soft/40 hover:text-ink"
    >
      {icon}
      {label}
    </button>
  );
}

// The document library as a right-side panel. Also the home of the old File
// menu: create/import actions at the top, download/print for the current
// document, then the searchable library. The full-screen library with
// previews and batch actions stays behind "All documents…".
export default function DocumentsPanel() {
  const ws = useWorkspace();
  const fileRef = useRef(null);
  const [docs, setDocs] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch("/api/documents")
      .then((data) => setDocs(data.documents))
      .catch((e) => {
        ws.showToast(e.message);
        setDocs([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openIds = new Set(ws.openDocs.map((d) => d.id));
  const filtered = (docs || []).filter((d) =>
    d.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-line py-2 pl-3 pr-2">
        <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-ink">
          <FolderOpen size={15} className="shrink-0 text-accent" />
          Documents
        </span>
        <button
          onClick={ws.closePanel}
          title="Close panel"
          aria-label="Close panel"
          className="shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex shrink-0 gap-1.5 px-3 pt-2.5">
        <ActionChip
          icon={<Plus size={15} strokeWidth={2.2} />}
          label="New"
          onClick={ws.createBlankDocument}
        />
        <ActionChip
          icon={<LayoutTemplate size={15} />}
          label="Templates"
          onClick={() => ws.setTemplatesOpen(true)}
        />
        <ActionChip
          icon={
            ws.uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />
          }
          label="Import"
          onClick={() => fileRef.current?.click()}
        />
      </div>

      {!!ws.activeDoc && (
        <div className="mx-3 mt-2.5 flex shrink-0 items-center gap-1 rounded-lg border border-line bg-canvas/60 px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate px-1 text-[12px] font-medium text-ink-soft">
            {ws.activeDoc.title}
          </span>
          <Dropdown
            align="right"
            items={[
              { heading: "Download as" },
              { label: "Word (.docx)", icon: <FileType2 size={14} />, onSelect: () => ws.downloadDocument("docx") },
              { label: "PDF (print)", icon: <Printer size={14} />, onSelect: () => ws.downloadDocument("pdf") },
              { label: "Markdown (.md)", icon: <FileDown size={14} />, onSelect: () => ws.downloadDocument("md") },
              { label: "HTML (.html)", icon: <FileCode2 size={14} />, onSelect: () => ws.downloadDocument("html") },
              { label: "Plain text (.txt)", icon: <FileText size={14} />, onSelect: () => ws.downloadDocument("txt") },
            ]}
            trigger={
              <button className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-canvas hover:text-ink data-[open]:bg-canvas">
                <FileDown size={13} />
                Download
                <ChevronDown size={12} />
              </button>
            }
          />
          <button
            onClick={() => ws.downloadDocument("pdf")}
            title="Print"
            aria-label="Print"
            className="shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
          >
            <Printer size={14} />
          </button>
        </div>
      )}

      <div className="shrink-0 px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-2 rounded-full border border-line-strong bg-paper px-3 py-1.5">
          <Search size={14} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {docs === null && (
          <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading documents…
          </p>
        )}
        {docs !== null && filtered.length === 0 && (
          <p className="px-4 py-3 text-[13px] leading-relaxed text-muted">
            {query
              ? "No documents match your search."
              : "Nothing here yet — create a document and it will show up here."}
          </p>
        )}
        {filtered.map((doc) => {
          const isOpen = openIds.has(doc.id);
          const isActive = doc.id === ws.activeDocId;
          return (
            <button
              key={doc.id}
              onClick={() => ws.openDocument(doc.id)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                isActive ? "bg-accent-soft" : "hover:bg-canvas"
              }`}
            >
              <FileText size={16} className={isActive ? "text-accent-deep" : "text-ink-soft"} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[13.5px] ${
                    isActive ? "font-semibold text-accent-deep" : "font-medium text-ink"
                  }`}
                >
                  {doc.title}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {timeAgo(doc.updatedAt)}
                  {isOpen && !isActive ? " · open" : ""}
                </span>
              </span>
              {isOpen && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-line p-2">
        <button
          onClick={() => ws.setFilesOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
        >
          <LayoutGrid size={14} />
          All documents…
        </button>
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
    </div>
  );
}

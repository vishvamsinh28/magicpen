"use client";

import { useEffect, useRef, useState } from "react";
import {
  FolderOpen, Loader2, LayoutGrid, Plus, LayoutTemplate, Upload,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { apiFetch } from "@/lib/client-utils";
import { PanelHeader, PanelSearch } from "./PanelChrome";
import ActiveDocBar from "./ActiveDocBar";
import DocumentRow from "./DocumentRow";

const ACCEPT = ".pdf,.docx,.txt,.rtf,.md,.markdown,.html,.htm";

// Square quick-action button for the New / Templates / Import strip.
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

/**
 * The document library as a right-side panel. Also the home of the old File
 * menu: create/import actions at the top, download/print for the current
 * document, then the searchable library. The full-screen library with
 * previews and batch actions stays behind "All documents…".
 */
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
      <PanelHeader
        gap
        icon={<FolderOpen size={15} className="shrink-0 text-accent" />}
        title="Documents"
        onClose={ws.closePanel}
      />

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

      <ActiveDocBar />

      <PanelSearch value={query} onChange={setQuery} placeholder="Search documents..." />

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
        {filtered.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            open={openIds.has(doc.id)}
            active={doc.id === ws.activeDocId}
            onOpen={() => ws.openDocument(doc.id)}
          />
        ))}
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

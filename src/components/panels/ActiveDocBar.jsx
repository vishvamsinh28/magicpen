"use client";

import {
  FileText, FileDown, Printer, FileType2, FileCode2, ChevronDown,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";

/**
 * Compact strip for the currently active document: its title, a "Download as"
 * menu (docx / pdf / md / html / txt via ws.downloadDocument), and a print
 * shortcut. Renders nothing when no document is open.
 */
export default function ActiveDocBar() {
  const ws = useWorkspace();
  if (!ws.activeDoc) return null;

  return (
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
  );
}

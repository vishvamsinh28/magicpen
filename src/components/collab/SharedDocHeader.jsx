"use client";

import { useState } from "react";
import { Download, Eye, Loader2, MessageSquare, MessageSquareText, Pencil } from "lucide-react";
import Logo from "@/components/Logo";
import Dropdown from "@/components/ui/Dropdown";
import PresenceBar from "@/components/collab/PresenceBar";
import { downloadBlob } from "@/lib/client-utils";

/**
 * Header bar of the share page: document title, the viewer's role badge, live
 * presence, the comments toggle, and — when the link allows it — a download
 * menu that exports through /api/export with the share token as auth.
 */

const ROLE_BADGE = {
  view: { label: "View only", icon: <Eye size={13} /> },
  comment: { label: "Can comment", icon: <MessageSquare size={13} /> },
  edit: { label: "Can edit", icon: <Pencil size={13} /> },
};

const FORMATS = [
  { label: "Word (.docx)", value: "docx" },
  { label: "PDF (print)", value: "pdf" },
  { label: "Markdown (.md)", value: "md" },
  { label: "Plain text (.txt)", value: "txt" },
];

export default function SharedDocHeader({
  info,
  editor,
  token,
  peers,
  canComment,
  commentsOpen,
  onToggleComments,
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async (format) => {
    if (!info) return;
    setDownloading(true);
    try {
      // Prefer the live editor content so unsaved keystrokes are included.
      const html = editor?.getHTML() ?? info.document?.contentHtml ?? "";
      if (format === "pdf") {
        // Print styling produces the PDF client-side; no export round trip.
        window.print();
        return;
      }
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-share-token": token },
        body: JSON.stringify({
          title: info.document.title,
          html,
          format,
          documentId: info.document.id,
        }),
      });
      if (!res.ok) throw new Error("Download failed");
      const ext = { docx: "docx", md: "md", txt: "txt" }[format] || format;
      downloadBlob(await res.blob(), `${info.document.title.replace(/[\\/:*?"<>|]+/g, "")}.${ext}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const badge = ROLE_BADGE[info?.role] || ROLE_BADGE.view;

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-paper px-3 py-2 md:px-4">
      <a href="/" className="flex shrink-0 items-center gap-2" aria-label="MagicPen">
        <Logo />
      </a>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">
        {info?.document?.title}
      </span>

      <span className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-medium text-ink-soft sm:flex">
        {badge.icon}
        {badge.label}
      </span>

      <PresenceBar peers={peers} selfId={info?.actor?.id} />

      {canComment && (
        <button
          onClick={onToggleComments}
          aria-pressed={commentsOpen}
          title="Comments"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            commentsOpen
              ? "bg-accent-soft text-accent-deep"
              : "text-ink-soft hover:bg-canvas hover:text-ink"
          }`}
        >
          <MessageSquareText size={17} strokeWidth={2} />
        </button>
      )}

      {info?.allowDownload && (
        <Dropdown
          align="right"
          items={FORMATS.map((f) => ({ label: f.label, onSelect: () => download(f.value) }))}
          trigger={
            <button className="flex items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-[13px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep">
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="hidden md:inline">Download</span>
            </button>
          }
        />
      )}
    </header>
  );
}

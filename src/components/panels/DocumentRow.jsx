"use client";

import { FileText } from "lucide-react";
import { timeAgo } from "@/lib/client-utils";

/**
 * One document row in the library list: icon, title, and age, with the
 * active document highlighted in accent and other open documents marked
 * by an "open" note plus a dot indicator.
 */
export default function DocumentRow({ doc, open, active, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
        active ? "bg-accent-soft" : "hover:bg-canvas"
      }`}
    >
      <FileText size={16} className={active ? "text-accent-deep" : "text-ink-soft"} />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13.5px] ${
            active ? "font-semibold text-accent-deep" : "font-medium text-ink"
          }`}
        >
          {doc.title}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-muted">
          {timeAgo(doc.updatedAt)}
          {open && !active ? " · open" : ""}
        </span>
      </span>
      {open && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
    </button>
  );
}

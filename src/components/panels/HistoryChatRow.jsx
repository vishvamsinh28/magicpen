"use client";

import { Check, Trash2, Waypoints } from "lucide-react";
import { timeAgo } from "@/lib/client-utils";

/**
 * One conversation row in the history list: selection checkbox (revealed on
 * hover, always visible in selection mode), title, scope + age line, and a
 * hover delete button. In selection mode a row click toggles the checkbox
 * instead of opening the chat.
 */
export default function HistoryChatRow({
  chat, active, checked, selectionMode, onOpen, onToggle, onDelete,
}) {
  return (
    <div
      onClick={() => (selectionMode ? onToggle() : onOpen())}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && (selectionMode ? onToggle() : onOpen())}
      className={`group flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 transition-colors ${
        active ? "bg-accent-soft" : "hover:bg-canvas"
      }`}
    >
      <button
        aria-label={checked ? `Deselect chat ${chat.title}` : `Select chat ${chat.title}`}
        aria-pressed={checked}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-[1.5px] transition-opacity ${
          checked
            ? "border-accent bg-accent text-white"
            : `border-line-strong bg-paper text-transparent hover:text-muted ${
                selectionMode ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              }`
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{chat.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
          {chat.scope === "cross" && <Waypoints size={11} />}
          {timeAgo(chat.updatedAt)}
        </p>
      </div>
      <button
        aria-label={`Delete chat ${chat.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-canvas hover:text-red-600 group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

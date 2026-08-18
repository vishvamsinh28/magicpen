"use client";

import {
  Paperclip, TriangleAlert, Pencil, FilePlus2, FileMinus2, FileText, Check,
} from "lucide-react";

const OP_ICONS = {
  replace: <Pencil size={11} />,
  insertAfter: <FilePlus2 size={11} />,
  insertBefore: <FilePlus2 size={11} />,
  delete: <FileMinus2 size={11} />,
  setDocument: <FileText size={11} />,
};

// Human-readable one-liner for an edit operation chip.
function opLabel(op) {
  switch (op.op) {
    case "replace": return `Edited block ${op.index + 1}`;
    case "insertAfter":
    case "insertBefore": return "Added content";
    case "delete": return `Removed block ${op.index + 1}`;
    case "setDocument": return "Wrote document";
    default: return op.op;
  }
}

// Chips summarizing a message's edit ops (first 6, then a "+n more" count)
// plus one status badge: applied / partial / pending / rejected / failed.
function EditChips({ edits, status, info }) {
  if (!edits?.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
      {edits.slice(0, 6).map((op, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] text-ink-soft"
        >
          {OP_ICONS[op.op]}
          {opLabel(op)}
        </span>
      ))}
      {edits.length > 6 && (
        <span className="text-[11px] text-muted">+{edits.length - 6} more</span>
      )}
      {status === "applied" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f3ec] px-2 py-0.5 text-[11px] font-medium text-good">
          <Check size={11} strokeWidth={3} /> Applied
        </span>
      )}
      {status === "partial" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f3ec] px-2 py-0.5 text-[11px] font-medium text-good">
          <Check size={11} strokeWidth={3} />
          Applied {info ? `${info.applied} of ${info.total}` : "selected"}
        </span>
      )}
      {status === "pending" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          Awaiting review
        </span>
      )}
      {status === "rejected" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
          Dismissed
        </span>
      )}
      {status === "failed" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
          <TriangleAlert size={11} /> Couldn&apos;t apply
        </span>
      )}
    </div>
  );
}

/**
 * One chat transcript entry. User messages render right-aligned with any
 * attachment chips; assistant errors render as a red card; normal assistant
 * replies render as a paper card with EditChips reflecting apply status.
 */
export default function MessageBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md border border-accent-faint bg-accent-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
          {message.attachments?.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {message.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md border border-accent-faint bg-paper px-1.5 py-0.5 text-[11px] text-ink-soft">
                  <Paperclip size={10} /> {a.name}
                </span>
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800">
        <p className="flex items-start gap-2">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{message.content}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3 text-[13.5px] leading-relaxed text-ink shadow-card">
      <p className="whitespace-pre-wrap">{message.content}</p>
      <EditChips edits={message.edits} status={message.appliedStatus} info={message.appliedInfo} />
    </div>
  );
}

/**
 * Animated "Working on it…" indicator shown while a send is in flight.
 * The three dots stagger via the shared mp-dot keyframe animation.
 */
export function TypingBubble() {
  return (
    <div className="flex w-fit items-center gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3 shadow-card">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="mp-dot h-1.5 w-1.5 rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="text-[12.5px] text-muted">Working on it…</span>
    </div>
  );
}

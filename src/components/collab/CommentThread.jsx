"use client";

import { Check, CornerDownRight, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/client-utils";

// Presentational pieces of the comments sidebar. All mutations are delegated
// upward through callbacks so CommentsSidebar keeps a single data path.

/** First letters of up to two name words, uppercased, for avatar badges. */
function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

/** Round initials badge. Comments carry no per-author color, so it is fixed. */
function Avatar({ name }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: "#7b8b9b" }}
    >
      {initials(name)}
    </span>
  );
}

/** One comment row: author line (with delete when permitted) plus body. */
function CommentItem({ comment, divider, canDelete, onDelete }) {
  return (
    <div className={divider ? "mt-2.5 border-t border-line pt-2.5" : ""}>
      <div className="flex items-center gap-2">
        <Avatar name={comment.authorName} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
          {comment.authorName}
          {comment.authorKind === "guest" && (
            <span className="ml-1 font-normal text-muted">· guest</span>
          )}
        </span>
        <span className="shrink-0 text-[11px] text-muted">{timeAgo(comment.createdAt)}</span>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(comment.id);
            }}
            aria-label="Delete comment"
            className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{comment.body}</p>
    </div>
  );
}

/**
 * One comment thread card: the anchored quote, root comment + replies, and —
 * for people who can comment — a reply box with resolve/reopen controls.
 * Clicking the card selects the thread (and the parent scrolls the document);
 * inner controls stop propagation so typing a reply doesn't re-trigger that.
 */
export default function CommentThread({
  thread,
  active,
  canComment,
  actor,
  role,
  replyValue,
  onReplyChange,
  onReply,
  onSetResolved,
  onDelete,
  onSelect,
}) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border p-3 shadow-card transition-colors ${
        active ? "border-accent bg-accent-soft/40" : "border-line bg-paper"
      } ${thread.resolved ? "opacity-60" : ""}`}
    >
      {thread.quote && (
        <p className="mb-2 border-l-[3px] border-amber-300 bg-amber-50/60 py-1 pl-2 text-[11.5px] italic leading-snug text-ink-soft">
          “{thread.quote.length > 120 ? `${thread.quote.slice(0, 120)}…` : thread.quote}”
        </p>
      )}

      {[thread.root, ...thread.replies].map((c, i) => (
        <CommentItem
          key={c.id}
          comment={c}
          divider={i > 0}
          canDelete={actor?.id === c.authorId || role === "owner"}
          onDelete={onDelete}
        />
      ))}

      {canComment && !thread.resolved && (
        <div className="mt-2.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <CornerDownRight size={13} className="shrink-0 text-muted" />
          <input
            value={replyValue}
            onChange={(e) => onReplyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onReply();
              }
            }}
            placeholder="Reply…"
            className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            onClick={() => onSetResolved(true)}
            title="Resolve thread"
            className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
          >
            <Check size={12} />
            Resolve
          </button>
        </div>
      )}

      {thread.resolved && (
        <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-good">
            <Check size={12} /> Resolved
            {thread.root.resolvedBy ? ` by ${thread.root.resolvedBy}` : ""}
          </span>
          {canComment && (
            <button
              onClick={() => onSetResolved(false)}
              className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
            >
              Reopen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

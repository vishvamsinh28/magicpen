"use client";

import { Loader2, MessageSquarePlus } from "lucide-react";

/**
 * New-thread composer pinned to the bottom of the comments sidebar. Shows what
 * the comment will anchor to (the current document selection, when there is
 * one) and submits on Cmd/Ctrl+Enter or the button. Draft state lives in the
 * parent so it survives this component unmounting.
 */
export default function CommentComposer({ selection, draft, onDraftChange, onSubmit, busy }) {
  return (
    <div className="shrink-0 border-t border-line bg-paper p-2.5">
      {selection ? (
        <p className="mb-1.5 truncate text-[11.5px] italic text-muted">
          On “{selection.quote.slice(0, 60)}
          {selection.quote.length > 60 ? "…" : ""}”
        </p>
      ) : (
        <p className="mb-1.5 text-[11.5px] text-muted">
          Select text in the document to anchor your comment.
        </p>
      )}
      <textarea
        rows={2}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Add a comment…"
        className="block w-full resize-none rounded-md border border-line bg-paper px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
      />
      <button
        onClick={onSubmit}
        disabled={!draft.trim() || busy}
        className={`mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-white transition-colors ${
          draft.trim() && !busy ? "bg-accent hover:bg-accent-deep" : "cursor-default bg-accent-disabled"
        }`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />}
        Comment
      </button>
    </div>
  );
}

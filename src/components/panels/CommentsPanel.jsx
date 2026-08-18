"use client";

import { X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import CommentsSidebar from "@/components/collab/CommentsSidebar";

// Owner-side comments, sharing the same sidebar the share page uses so both
// sides of a conversation look and behave identically.
export default function CommentsPanel() {
  const ws = useWorkspace();
  const { activeDocId, editorInstance, user } = ws;

  if (!activeDocId) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-paper">
        <div className="flex shrink-0 items-center justify-between border-b border-line py-2 pl-3 pr-2">
          <span className="text-[13.5px] font-semibold text-ink">Comments</span>
          <button
            onClick={ws.closePanel}
            title="Close panel"
            aria-label="Close panel"
            className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 px-3 py-3.5">
          <p className="px-1 py-2 text-[13px] leading-relaxed text-muted">
            Open a document to read and write comments on it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CommentsSidebar
      key={activeDocId}
      documentId={activeDocId}
      editor={editorInstance}
      actor={user ? { id: user.id, name: user.name || user.email } : null}
      role="owner"
      onClose={ws.closePanel}
    />
  );
}

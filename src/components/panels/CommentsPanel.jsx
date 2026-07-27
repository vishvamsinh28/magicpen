"use client";

import { useWorkspace } from "@/components/workspace-context";
import CommentsSidebar from "@/components/collab/CommentsSidebar";

// Owner-side comments, sharing the same sidebar the share page uses so both
// sides of a conversation look and behave identically.
export default function CommentsPanel() {
  const ws = useWorkspace();
  const { activeDocId, editorInstance, user } = ws;

  if (!activeDocId) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2.5">
        <div className="flex shrink-0 items-center justify-between rounded-[5px] border-[1.5px] border-frame bg-paper py-1 pl-3 pr-2">
          <span className="py-1.5 text-[13.5px] font-semibold text-ink">Comments</span>
          <button
            onClick={() => ws.setLeftView("chat")}
            className="rounded-md px-2 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-cream"
          >
            Back to chat
          </button>
        </div>
        <div className="min-h-0 flex-1 rounded-[5px] border-[1.5px] border-frame bg-paper px-3 py-3.5">
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
      onClose={() => ws.setLeftView("chat")}
    />
  );
}

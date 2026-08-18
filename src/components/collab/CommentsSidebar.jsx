"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, X } from "lucide-react";
import { docTextIndex, offsetOfPos, findQuoteRange, setCommentState } from "@/components/editor/comments";
import { useCommentThreads } from "@/components/collab/useCommentThreads";
import CommentThread from "@/components/collab/CommentThread";
import CommentComposer from "@/components/collab/CommentComposer";

/**
 * Comment threads for a document, usable from both the workspace and a share
 * link (`shareToken` carries guest auth). Data lives in useCommentThreads;
 * this component wires the editor: it feeds thread anchors to the highlight
 * plugin, tracks the live selection for new comments, and scrolls the
 * document when a thread is selected.
 */
export default function CommentsSidebar({
  documentId,
  editor,
  actor,
  role,
  shareToken = null,
  onClose = null,
}) {
  const { threads, loading, busy, post, patchComment, removeComment } = useCommentThreads({
    documentId,
    shareToken,
  });
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState({});
  const [showResolved, setShowResolved] = useState(false);
  const [selection, setSelection] = useState(null); // {quote, anchorStart}

  const visible = threads.filter((t) => (showResolved ? true : !t.resolved));
  const canComment = role === "owner" || role === "edit" || role === "comment";

  // Feed anchors + selection into the editor's decoration plugin.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setCommentState(editor, {
      threads: threads.map((t) => ({
        threadId: t.threadId,
        quote: t.quote,
        anchorStart: t.anchorStart,
        resolved: t.resolved,
      })),
      activeId,
    });
  }, [editor, threads, activeId]);

  // Clicking highlighted text in the document selects that thread here. The
  // editor is swapped when documents change, so only bind to a mounted view.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view?.dom;
    if (!dom) return;
    const onClick = (e) => setActiveId(e.detail);
    dom.addEventListener("mp-comment-click", onClick);
    return () => dom.removeEventListener("mp-comment-click", onClick);
  }, [editor]);

  // Track the live selection so the composer knows what to quote.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const read = () => {
      if (editor.isDestroyed) return;
      const { from, to, empty } = editor.state.selection;
      if (empty) return setSelection(null);
      const text = editor.state.doc.textBetween(from, to, " ").trim();
      if (!text) return setSelection(null);
      const index = docTextIndex(editor.state.doc);
      setSelection({ quote: text.slice(0, 400), anchorStart: offsetOfPos(index, from) });
    };
    read();
    editor.on("selectionUpdate", read);
    return () => editor.off("selectionUpdate", read);
  }, [editor]);

  const addThread = async () => {
    const text = draft.trim();
    if (!text) return;
    const ok = await post({
      text,
      quote: selection?.quote || "",
      anchorStart: selection?.anchorStart ?? null,
    });
    if (ok) setDraft("");
  };

  const addReply = async (threadId) => {
    const text = (replyDraft[threadId] || "").trim();
    if (!text) return;
    const ok = await post({ threadId, text });
    if (ok) setReplyDraft((p) => ({ ...p, [threadId]: "" }));
  };

  // Selecting a thread also scrolls the document to its anchored quote.
  const focusThread = (thread) => {
    setActiveId(thread.threadId);
    if (!editor || editor.isDestroyed || !editor.view || !thread.quote) return;
    try {
      const range = findQuoteRange(docTextIndex(editor.state.doc), thread.quote, thread.anchorStart);
      if (!range) return;
      const dom = editor.view.domAtPos(range.from);
      const el = dom.node.nodeType === 1 ? dom.node : dom.node.parentElement;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (err) {
      // Scrolling is a nicety; a stale position must not break selection.
      console.warn(`comments: could not scroll to thread anchor: ${err.message}`);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="flex shrink-0 items-center justify-between border-b border-line py-2 pl-3 pr-2">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <MessageSquare size={15} />
          Comments
          {visible.length > 0 && <span className="font-normal text-muted">· {visible.length}</span>}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowResolved((v) => !v)}
            aria-pressed={showResolved}
            className={`rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors ${
              showResolved ? "bg-accent-soft text-accent-deep" : "text-ink-soft hover:bg-canvas"
            }`}
          >
            Resolved
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close panel"
              aria-label="Close panel"
              className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3.5">
        {loading && (
          <p className="flex items-center gap-2 px-1 py-2 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading comments…
          </p>
        )}

        {!loading && visible.length === 0 && (
          <p className="px-1 py-2 text-[13px] leading-relaxed text-muted">
            {canComment
              ? "No comments yet. Select text in the document and add one below."
              : "No comments on this document."}
          </p>
        )}

        {visible.map((thread) => (
          <CommentThread
            key={thread.threadId}
            thread={thread}
            active={activeId === thread.threadId}
            canComment={canComment}
            actor={actor}
            role={role}
            replyValue={replyDraft[thread.threadId] || ""}
            onReplyChange={(v) => setReplyDraft((p) => ({ ...p, [thread.threadId]: v }))}
            onReply={() => addReply(thread.threadId)}
            onSetResolved={(resolved) => patchComment(thread.root.id, { resolved })}
            onDelete={removeComment}
            onSelect={() => focusThread(thread)}
          />
        ))}
      </div>

      {canComment && (
        <CommentComposer
          selection={selection}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={addThread}
          busy={busy}
        />
      )}
    </div>
  );
}

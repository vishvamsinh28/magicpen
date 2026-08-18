"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquarePlus, Check, Trash2, Loader2, CornerDownRight, MessageSquare, X } from "lucide-react";
import { apiFetch, timeAgo } from "@/lib/client-utils";
import { docTextIndex, offsetOfPos, findQuoteRange, setCommentState } from "@/components/editor/comments";

// Comment threads for a document, usable from both the workspace and a share
// link. Threads are grouped client-side; the server stores flat comments so a
// reply is just another row carrying the same threadId.

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

function Avatar({ name, color }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: color || "#7b8b9b" }}
    >
      {initials(name)}
    </span>
  );
}

export default function CommentsSidebar({
  documentId,
  editor,
  actor,
  role,
  shareToken = null,
  onClose = null,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selection, setSelection] = useState(null); // {quote, anchorStart}
  const listRef = useRef(null);

  const headers = useMemo(
    () => (shareToken ? { "x-share-token": shareToken } : undefined),
    [shareToken]
  );
  const withToken = useCallback(
    (url) => (shareToken ? `${url}${url.includes("?") ? "&" : "?"}shareToken=${shareToken}` : url),
    [shareToken]
  );

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(withToken(`/api/comments?documentId=${documentId}`), { headers });
      setComments(data.comments || []);
    } catch {
      // A transient failure shouldn't blank the sidebar.
    } finally {
      setLoading(false);
    }
  }, [documentId, headers, withToken]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  // Group flat comments into threads, root first.
  const threads = useMemo(() => {
    const byThread = new Map();
    for (const c of comments) {
      if (!byThread.has(c.threadId)) byThread.set(c.threadId, []);
      byThread.get(c.threadId).push(c);
    }
    return [...byThread.entries()].map(([threadId, items]) => ({
      threadId,
      root: items[0],
      replies: items.slice(1),
      resolved: !!items[0].resolved,
      quote: items[0].quote,
      anchorStart: items[0].anchorStart,
    }));
  }, [comments]);

  const visible = threads.filter((t) => (showResolved ? true : !t.resolved));

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

  // Track the live selection so "Comment on selection" knows what to quote.
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

  const post = async (payload) => {
    setBusy(true);
    try {
      await apiFetch(withToken("/api/comments"), {
        method: "POST",
        headers,
        body: JSON.stringify({ documentId, ...payload }),
      });
      await load();
      return true;
    } catch (e) {
      alert(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

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

  const patchComment = async (id, changes) => {
    try {
      await apiFetch(withToken(`/api/comments/${id}`), {
        method: "PATCH",
        headers,
        body: JSON.stringify(changes),
      });
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const removeComment = async (id) => {
    try {
      await apiFetch(withToken(`/api/comments/${id}`), { method: "DELETE", headers });
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  // Selecting a thread scrolls the document to its anchor.
  const focusThread = (thread) => {
    setActiveId(thread.threadId);
    if (!editor || editor.isDestroyed || !editor.view || !thread.quote) return;
    const range = findQuoteRange(docTextIndex(editor.state.doc), thread.quote, thread.anchorStart);
    if (!range) return;
    const dom = editor.view.domAtPos(range.from);
    const el = dom.node.nodeType === 1 ? dom.node : dom.node.parentElement;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const canComment = role === "owner" || role === "edit" || role === "comment";

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

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3.5"
      >
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
          <div
            key={thread.threadId}
            onClick={() => focusThread(thread)}
            className={`cursor-pointer rounded-xl border p-3 shadow-card transition-colors ${
              activeId === thread.threadId ? "border-accent bg-accent-soft/40" : "border-line bg-paper"
            } ${thread.resolved ? "opacity-60" : ""}`}
          >
            {thread.quote && (
              <p className="mb-2 border-l-[3px] border-amber-300 bg-amber-50/60 py-1 pl-2 text-[11.5px] italic leading-snug text-ink-soft">
                “{thread.quote.length > 120 ? `${thread.quote.slice(0, 120)}…` : thread.quote}”
              </p>
            )}

            {[thread.root, ...thread.replies].map((c, i) => (
              <div key={c.id} className={i > 0 ? "mt-2.5 border-t border-line pt-2.5" : ""}>
                <div className="flex items-center gap-2">
                  <Avatar name={c.authorName} color={undefined} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                    {c.authorName}
                    {c.authorKind === "guest" && (
                      <span className="ml-1 font-normal text-muted">· guest</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.createdAt)}</span>
                  {(actor?.id === c.authorId || role === "owner") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeComment(c.id);
                      }}
                      aria-label="Delete comment"
                      className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{c.body}</p>
              </div>
            ))}

            {canComment && !thread.resolved && (
              <div className="mt-2.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <CornerDownRight size={13} className="shrink-0 text-muted" />
                <input
                  value={replyDraft[thread.threadId] || ""}
                  onChange={(e) => setReplyDraft((p) => ({ ...p, [thread.threadId]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addReply(thread.threadId);
                    }
                  }}
                  placeholder="Reply…"
                  className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-accent"
                />
                <button
                  onClick={() => patchComment(thread.root.id, { resolved: true })}
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
                    onClick={() => patchComment(thread.root.id, { resolved: false })}
                    className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
                  >
                    Reopen
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {canComment && (
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
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                addThread();
              }
            }}
            placeholder="Add a comment…"
            className="block w-full resize-none rounded-md border border-line bg-paper px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            onClick={addThread}
            disabled={!draft.trim() || busy}
            className={`mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-white transition-colors ${
              draft.trim() && !busy ? "bg-accent hover:bg-accent-deep" : "cursor-default bg-accent-disabled"
            }`}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />}
            Comment
          </button>
        </div>
      )}
    </div>
  );
}

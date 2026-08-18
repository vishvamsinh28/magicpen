"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-utils";

const POLL_MS = 6000;

/**
 * Data layer for a document's comments: loads and polls the flat comment list,
 * groups it into threads, and exposes the mutations the sidebar needs. Works
 * for both the signed-in workspace and share links — a `shareToken` carries
 * guest auth on every request. Mutation failures surface via alert (the
 * sidebar's established pattern); poll failures retry silently.
 */
export function useCommentThreads({ documentId, shareToken = null }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
      if (data) setComments(data.comments || []);
    } catch {
      // A transient failure shouldn't blank the sidebar; the poll retries.
    } finally {
      setLoading(false);
    }
  }, [documentId, headers, withToken]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Group flat comments into threads. The server returns rows in creation
  // order, so within a thread items[0] is always the root and the rest are
  // replies carrying the same threadId.
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
      resolved: !!items[0]?.resolved,
      quote: items[0]?.quote,
      anchorStart: items[0]?.anchorStart,
    }));
  }, [comments]);

  /** POST a new comment (thread root or reply). Resolves true on success. */
  const post = useCallback(
    async (payload) => {
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
    },
    [documentId, headers, withToken, load]
  );

  /** PATCH one comment (used to resolve/reopen a thread via its root). */
  const patchComment = useCallback(
    async (id, changes) => {
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
    },
    [headers, withToken, load]
  );

  /** DELETE one comment. */
  const removeComment = useCallback(
    async (id) => {
      try {
        await apiFetch(withToken(`/api/comments/${id}`), { method: "DELETE", headers });
        await load();
      } catch (e) {
        alert(e.message);
      }
    },
    [headers, withToken, load]
  );

  return { threads, loading, busy, post, patchComment, removeComment };
}

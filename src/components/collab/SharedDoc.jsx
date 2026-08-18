"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import PromptDialog from "@/components/ui/PromptDialog";
import CommentsSidebar from "@/components/collab/CommentsSidebar";
import SharedDocHeader from "@/components/collab/SharedDocHeader";
import { CollabEditor, ReadOnlyDoc } from "@/components/collab/SharedDocEditors";
import { apiFetch } from "@/lib/client-utils";

/**
 * The page behind a share link: resolves the token to a document + role, then
 * composes the header, the right document body (live CRDT editor for `edit`,
 * polling read-only render otherwise), the comments overlay, and the one-time
 * guest name prompt. Presence flows up from the editor via the `mp-peers`
 * window event so the header can render it.
 */
export default function SharedDoc({ token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [editor, setEditor] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [askName, setAskName] = useState(false);
  const [peers, setPeers] = useState([]);

  useEffect(() => {
    apiFetch(`/api/share/${token}`)
      .then((data) => {
        setInfo(data);
        // Guests introduce themselves once so their comments aren't anonymous.
        if (data.actor?.kind === "guest" && !data.actor.name && data.role !== "view") {
          setAskName(true);
        }
      })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    const onPeers = (e) => setPeers(e.detail?.peers || []);
    window.addEventListener("mp-peers", onPeers);
    return () => window.removeEventListener("mp-peers", onPeers);
  }, []);

  const onEditorReady = useCallback((ed) => setEditor(ed), []);

  // Persist collaborator edits as HTML so the owner's side stays current.
  const saveHtml = useCallback(
    async (html) => {
      const documentId = info?.document?.id;
      if (!documentId) return;
      try {
        await apiFetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "x-share-token": token },
          body: JSON.stringify({ contentHtml: html }),
        });
      } catch {
        // The CRDT still holds the change; the next debounced save retries.
      }
    },
    [info, token]
  );

  if (error) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <TriangleAlert size={30} className="text-accent" />
        <h1 className="text-[19px] font-bold text-ink">This link isn&apos;t working</h1>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-muted">{error}</p>
        <a
          href="/"
          className="mt-2 rounded-full border border-line-strong bg-paper px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-canvas"
        >
          Go to MagicPen
        </a>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas">
        <Loader2 size={20} className="animate-spin text-accent" />
        <p className="text-[13.5px] text-muted">Opening the document…</p>
      </main>
    );
  }

  const canComment = info.role === "comment" || info.role === "edit";

  return (
    <div className="flex h-dvh flex-col bg-canvas-deep">
      <SharedDocHeader
        info={info}
        editor={editor}
        token={token}
        peers={peers}
        canComment={canComment}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen((v) => !v)}
      />

      <main className="relative flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 md:px-10 md:py-8">
            {info.role === "edit" ? (
              <CollabEditor
                info={info}
                token={token}
                onEditorReady={onEditorReady}
                onSavedHtml={saveHtml}
              />
            ) : (
              <ReadOnlyDoc info={info} token={token} onEditorReady={onEditorReady} />
            )}
          </div>
        </section>

        {canComment && commentsOpen && (
          // A docked column on desktop; slides over the document on smaller
          // screens so comments stay reachable everywhere.
          <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[380px] shrink-0 flex-col border-l border-line bg-paper shadow-pop lg:static lg:z-auto lg:w-[340px] lg:max-w-none lg:shadow-none">
            <CommentsSidebar
              documentId={info.document.id}
              editor={editor}
              actor={info.actor}
              role={info.role}
              shareToken={token}
              onClose={() => setCommentsOpen(false)}
            />
          </aside>
        )}
      </main>

      <PromptDialog
        open={askName}
        title="What should we call you?"
        placeholder="Your name"
        confirmLabel="Continue"
        onSubmit={async (name) => {
          try {
            const data = await apiFetch(`/api/share/${token}`, {
              method: "PATCH",
              body: JSON.stringify({ name }),
            });
            if (data?.actor) setInfo((prev) => ({ ...prev, actor: data.actor }));
          } catch {
            /* a nameless guest still works, they just show as "Guest" */
          }
          setAskName(false);
        }}
        onCancel={() => setAskName(false)}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { CloudOff, Loader2 } from "lucide-react";
import Toolbar from "@/components/editor/Toolbar";
import { createExtensions } from "@/components/editor/extensions";
import { useCollab } from "@/components/collab/useCollab";
import { apiFetch } from "@/lib/client-utils";

// Document bodies for the share page. Editors get the live CRDT editor;
// viewers and commenters get a read-only render that refreshes as editors
// save, which keeps their path simple and means they never need the
// collaboration channel.

const SAVE_DEBOUNCE_MS = 900;
const READONLY_POLL_MS = 5000;

// Presence lives in the page header, so the editor just publishes upward. The
// {peers, selfId} detail shape is consumed elsewhere — keep it stable.
function PresenceHidden({ peers, selfId }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mp-peers", { detail: { peers, selfId } }));
  }, [peers, selfId]);
  return null;
}

/**
 * Live collaborative editor for `edit` share links: binds TipTap to the
 * shared Yjs document, seeds a freshly shared doc exactly once (only the
 * claim winner plants content), and debounces edits into `onSavedHtml` so the
 * owner's stored HTML keeps up with collaborators.
 */
export function CollabEditor({ info, token, onEditorReady, onSavedHtml }) {
  const { ydoc, ready, needsSeed, peers, online } = useCollab({
    documentId: info?.document?.id,
    shareToken: token,
  });
  const seededRef = useRef(false);
  const saveTimer = useRef(null);

  const editor = useEditor(
    {
      extensions: createExtensions({ ydoc }),
      immediatelyRender: false,
      editorProps: { attributes: { spellcheck: "true" } },
      onUpdate: ({ editor: ed }) => {
        // Keep the stored HTML current so exports, AI edits and commits on the
        // owner's side see collaborator changes too.
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => onSavedHtml(ed.getHTML()), SAVE_DEBOUNCE_MS);
      },
    },
    [ydoc]
  );

  useEffect(() => {
    if (editor) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // First client into a freshly shared document plants the current content.
  // useEditor tears down and rebuilds the editor when `ydoc` arrives, so guard
  // against a torn-down instance (whose commands are gone) landing here.
  useEffect(() => {
    if (!editor || editor.isDestroyed || !ready || !needsSeed || seededRef.current) return;
    seededRef.current = true;
    try {
      editor.commands.setContent(info?.document?.contentHtml || "", { emitUpdate: true });
    } catch (err) {
      // Better an unseeded doc than a crash; sync still delivers content.
      console.warn(`share: seeding editor content failed: ${err.message}`);
    }
  }, [editor, ready, needsSeed, info?.document?.contentHtml]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!ready) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted">
        <Loader2 size={15} className="animate-spin" /> Connecting to the document…
      </p>
    );
  }

  return (
    <>
      <div className="mb-3">
        <Toolbar editor={editor} />
      </div>
      {!online && (
        <p className="mb-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
          <CloudOff size={13} /> Reconnecting — your changes are saved locally and will sync.
        </p>
      )}
      <div className="doc-editor mx-auto w-[850px] max-w-full cursor-text rounded-[4px] bg-paper px-7 py-12 shadow-card ring-1 ring-line md:px-[88px] md:py-[76px]">
        <EditorContent editor={editor} />
      </div>
      <PresenceHidden peers={peers} selfId={info?.actor?.id} />
    </>
  );
}

/**
 * Read-only render for view/comment share links. Polls the share endpoint and
 * swaps in new content whenever an editor saves, so watchers stay current
 * without ever joining the collaboration channel.
 */
export function ReadOnlyDoc({ info, token, onEditorReady }) {
  const editor = useEditor({
    extensions: createExtensions(),
    editable: false,
    immediatelyRender: false,
    content: info?.document?.contentHtml || "",
  });
  // Last content applied to the editor — a ref so the poll compares against the
  // current value without re-subscribing the interval on every change.
  const appliedRef = useRef(info?.document?.contentHtml || "");

  useEffect(() => {
    if (editor) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // Poll for edits made by other people.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await apiFetch(`/api/share/${token}`);
        if (cancelled || !data?.document) return;
        const next = data.document.contentHtml || "";
        if (next === appliedRef.current) return;
        appliedRef.current = next;
        if (editor && !editor.isDestroyed) editor.commands.setContent(next, { emitUpdate: false });
      } catch {
        // Keep showing what we have; the next poll retries.
      }
    };
    const t = setInterval(tick, READONLY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token, editor]);

  return (
    <div className="doc-editor mx-auto w-[850px] max-w-full rounded-[4px] bg-paper px-7 py-12 shadow-card ring-1 ring-line md:px-[88px] md:py-[76px]">
      <EditorContent editor={editor} />
    </div>
  );
}

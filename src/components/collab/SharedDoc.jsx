"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  Loader2, Download, Eye, MessageSquare, Pencil, TriangleAlert, MessageSquareText, CloudOff,
} from "lucide-react";
import Logo from "@/components/Logo";
import Dropdown from "@/components/ui/Dropdown";
import PromptDialog from "@/components/ui/PromptDialog";
import Toolbar from "@/components/editor/Toolbar";
import { createExtensions } from "@/components/editor/extensions";
import CommentsSidebar from "@/components/collab/CommentsSidebar";
import PresenceBar from "@/components/collab/PresenceBar";
import { useCollab } from "@/components/collab/useCollab";
import { apiFetch, downloadBlob } from "@/lib/client-utils";

// The page behind a share link. Editors get the live CRDT editor; viewers and
// commenters get a read-only render that refreshes as editors save, which
// keeps their path simple and means they never need the collaboration socket.

const ROLE_BADGE = {
  view: { label: "View only", icon: <Eye size={13} /> },
  comment: { label: "Can comment", icon: <MessageSquare size={13} /> },
  edit: { label: "Can edit", icon: <Pencil size={13} /> },
};

const FORMATS = [
  { label: "Word (.docx)", value: "docx" },
  { label: "PDF (print)", value: "pdf" },
  { label: "Markdown (.md)", value: "md" },
  { label: "Plain text (.txt)", value: "txt" },
];

/* ------------------------------ live editor ------------------------------- */

function CollabEditor({ info, token, onEditorReady, onSavedHtml }) {
  const { ydoc, ready, needsSeed, peers, online } = useCollab({
    documentId: info.document.id,
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
        saveTimer.current = setTimeout(() => onSavedHtml(ed.getHTML()), 900);
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
    editor.commands.setContent(info.document.contentHtml || "", { emitUpdate: true });
  }, [editor, ready, needsSeed, info.document.contentHtml]);

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
      <div className="mb-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Toolbar editor={editor} />
        </div>
      </div>
      {!online && (
        <p className="mb-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
          <CloudOff size={13} /> Reconnecting — your changes are saved locally and will sync.
        </p>
      )}
      <div className="doc-editor mx-auto w-[850px] max-w-full cursor-text rounded-[3px] bg-paper px-7 py-12 shadow-card ring-1 ring-line md:px-[88px] md:py-[76px]">
        <EditorContent editor={editor} />
      </div>
      <PresenceHidden peers={peers} selfId={info.actor?.id} />
    </>
  );
}

// Presence lives in the header, so the editor just publishes upward.
function PresenceHidden({ peers, selfId }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sd-peers", { detail: { peers, selfId } }));
  }, [peers, selfId]);
  return null;
}

/* ---------------------------- read-only viewer ---------------------------- */

function ReadOnlyDoc({ info, token, onEditorReady }) {
  const editor = useEditor({
    extensions: createExtensions(),
    editable: false,
    immediatelyRender: false,
    content: info.document.contentHtml || "",
  });
  // Last content applied to the editor — a ref so the poll compares against the
  // current value without re-subscribing the interval on every change.
  const appliedRef = useRef(info.document.contentHtml || "");

  useEffect(() => {
    if (editor) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // Poll for edits made by other people.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await apiFetch(`/api/share/${token}`);
        if (cancelled) return;
        const next = data.document.contentHtml || "";
        if (next === appliedRef.current) return;
        appliedRef.current = next;
        if (editor && !editor.isDestroyed) editor.commands.setContent(next, { emitUpdate: false });
      } catch {
        /* keep showing what we have */
      }
    };
    const t = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token, editor]);

  return (
    <div className="doc-editor mx-auto w-[850px] max-w-full rounded-[3px] bg-paper px-7 py-12 shadow-card ring-1 ring-line md:px-[88px] md:py-[76px]">
      <EditorContent editor={editor} />
    </div>
  );
}

/* --------------------------------- shell ---------------------------------- */

export default function SharedDoc({ token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [editor, setEditor] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [askName, setAskName] = useState(false);
  const [peers, setPeers] = useState([]);
  const [downloading, setDownloading] = useState(false);

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
    const onPeers = (e) => setPeers(e.detail.peers || []);
    window.addEventListener("sd-peers", onPeers);
    return () => window.removeEventListener("sd-peers", onPeers);
  }, []);

  const onEditorReady = useCallback((ed) => setEditor(ed), []);

  const saveHtml = useCallback(
    async (html) => {
      try {
        await apiFetch(`/api/documents/${info.document.id}`, {
          method: "PATCH",
          headers: { "x-share-token": token },
          body: JSON.stringify({ contentHtml: html }),
        });
      } catch {
        /* the CRDT still holds the change; the next save will retry */
      }
    },
    [info, token]
  );

  const download = async (format) => {
    if (!info) return;
    setDownloading(true);
    try {
      const html = editor?.getHTML() ?? info.document.contentHtml ?? "";
      if (format === "pdf") {
        window.print();
        return;
      }
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-share-token": token },
        body: JSON.stringify({
          title: info.document.title,
          html,
          format,
          documentId: info.document.id,
        }),
      });
      if (!res.ok) throw new Error("Download failed");
      const ext = { docx: "docx", md: "md", txt: "txt" }[format] || format;
      downloadBlob(await res.blob(), `${info.document.title.replace(/[\\/:*?"<>|]+/g, "")}.${ext}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <TriangleAlert size={30} className="text-accent" />
        <h1 className="text-[19px] font-bold text-ink">This link isn&apos;t working</h1>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-muted">{error}</p>
        <a
          href="/"
          className="mt-2 rounded-lg border-[1.5px] border-frame bg-paper px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-cream"
        >
          Go to SuperDocs
        </a>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-cream">
        <Loader2 size={20} className="animate-spin text-accent" />
        <p className="text-[13.5px] text-muted">Opening the document…</p>
      </main>
    );
  }

  const badge = ROLE_BADGE[info.role] || ROLE_BADGE.view;
  const canComment = info.role === "comment" || info.role === "edit";

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <header className="flex shrink-0 items-center gap-2 px-3 py-2.5 md:px-5">
        <a href="/" className="flex shrink-0 items-center gap-2" aria-label="SuperDocs">
          <Logo />
        </a>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
          {info.document.title}
        </span>

        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-medium text-ink-soft sm:flex">
          {badge.icon}
          {badge.label}
        </span>

        <PresenceBar peers={peers} selfId={info.actor?.id} />

        {canComment && (
          <button
            onClick={() => setCommentsOpen((v) => !v)}
            aria-pressed={commentsOpen}
            className={`flex items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 py-2 text-[13px] font-semibold transition-colors ${
              commentsOpen
                ? "border-accent bg-accent-soft text-accent-deep"
                : "border-frame bg-paper text-ink hover:bg-cream"
            }`}
          >
            <MessageSquareText size={15} />
            <span className="hidden md:inline">Comments</span>
          </button>
        )}

        {info.allowDownload && (
          <Dropdown
            align="right"
            items={FORMATS.map((f) => ({ label: f.label, onSelect: () => download(f.value) }))}
            trigger={
              <button className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep">
                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                <span className="hidden md:inline">Download</span>
              </button>
            }
          />
        )}
      </header>

      <main className="flex min-h-0 flex-1 gap-3 px-3 pb-3 md:px-5 md:pb-4">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[5px] border-[1.5px] border-frame bg-parchment px-3 py-6 md:px-10 md:py-9">
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
          <aside className="hidden w-[340px] shrink-0 lg:flex lg:flex-col">
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
            setInfo((prev) => ({ ...prev, actor: data.actor }));
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

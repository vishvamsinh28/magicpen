"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";

/**
 * Browser-style tab strip for the header: every open document is a tab —
 * click to switch, × to close, "+" for a new blank document. The active tab
 * shows an always-visible pencil so renaming is discoverable; the pencil or
 * the active tab's label starts an inline edit (Enter/blur commit, Escape
 * cancels). Internal to Header — import it from there, not directly.
 */
export default function DocTabs() {
  const ws = useWorkspace();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const activeTabRef = useRef(null);

  // Keep the active tab in view when the strip overflows (narrow screens).
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [ws.activeDocId]);

  const startRename = (doc) => {
    setEditingId(doc.id);
    setDraft(doc.title);
  };

  // Fire-and-forget: renameDocument toasts its own failures and never
  // rejects, so the inline editor can close immediately.
  const commit = () => {
    const doc = ws.openDocs.find((d) => d.id === editingId);
    const next = draft.trim();
    if (doc && next && next !== doc.title) ws.renameDocument(doc.id, next);
    setEditingId(null);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ws.openDocs.length === 0 && (
        <span className="font-display px-1 text-[19px] font-bold tracking-tight text-ink">
          MagicPen
        </span>
      )}
      {ws.openDocs.map((doc) => {
        const active = doc.id === ws.activeDocId;
        const editing = editingId === doc.id;
        return (
          <div
            key={doc.id}
            ref={active ? activeTabRef : undefined}
            className={`group flex h-9 max-w-[210px] shrink-0 items-center gap-1 rounded-lg px-2.5 transition-colors ${
              active ? "bg-accent-soft text-accent-deep" : "text-ink-soft hover:bg-canvas"
            }`}
          >
            {editing ? (
              <input
                autoFocus
                value={draft}
                aria-label="Document name"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-36 bg-transparent text-[13px] font-medium text-ink outline-none"
              />
            ) : (
              <>
                <button
                  onClick={() => (active ? startRename(doc) : ws.openDocument(doc.id))}
                  title={active ? "Rename" : doc.sourceFile?.name || doc.title}
                  className="min-w-0 truncate text-[13px] font-medium"
                >
                  {doc.sourceFile?.name || doc.title}
                </button>
                {active && (
                  <button
                    onClick={() => startRename(doc)}
                    aria-label={`Rename ${doc.title}`}
                    title="Rename"
                    className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:bg-accent-faint hover:opacity-100"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    ws.closeDocument(doc.id);
                  }}
                  aria-label={`Close ${doc.title}`}
                  className={`shrink-0 rounded p-0.5 transition-opacity ${
                    active
                      ? "opacity-70 hover:bg-accent-faint hover:opacity-100"
                      : "opacity-0 hover:bg-line focus-visible:opacity-100 group-hover:opacity-100"
                  }`}
                >
                  <X size={12.5} />
                </button>
              </>
            )}
          </div>
        );
      })}
      <button
        onClick={ws.createBlankDocument}
        aria-label="New document"
        title="New document"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
      >
        <Plus size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}

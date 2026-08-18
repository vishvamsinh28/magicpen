"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  FileText, Upload, Loader2, Minus, Plus, ShieldCheck, Eye, RotateCcw, X,
  ArrowUp, ArrowDown, CaseSensitive, ListTree,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { buildDiffPreviewHtml } from "@/lib/diff";
import { diffHtml } from "@/lib/htmldiff";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCollab } from "@/components/collab/useCollab";
import { createExtensions } from "./extensions";
import { findMatches, searchPluginKey } from "./search";

const ZOOM_STEPS = [50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];
const ACCEPT = ".pdf,.docx,.txt,.rtf,.md,.markdown,.html,.htm";

// Sticky bar shown while a commit is previewed on the page. Compare overlays
// red/green marks for what restoring this commit would change.
function VersionBar() {
  const ws = useWorkspace();
  const { versionPreview } = ws;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!versionPreview) return null;

  const when = new Date(versionPreview.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="pointer-events-none sticky top-2.5 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-full border border-line bg-paper py-1.5 pl-4 pr-1.5 shadow-pop">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Eye size={15} />
          <span className="max-w-44 truncate">
            {versionPreview.label ? `“${versionPreview.label}”` : "Commit"}
          </span>
        </span>
        <span className="hidden text-[12px] text-muted sm:inline">{when}</span>
        {versionPreview.compare && (
          <span className="hidden items-center gap-1.5 text-[12px] text-muted md:flex">
            <ins className="rounded-[3px] bg-[#e3f1e8] px-1 text-good no-underline">restored</ins>
            <del className="rounded-[3px] bg-red-50 px-1 text-red-700 decoration-red-400">replaced</del>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <button
            onClick={ws.toggleVersionCompare}
            aria-pressed={versionPreview.compare}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
              versionPreview.compare
                ? "border-accent bg-accent-soft text-accent-deep"
                : "border-line bg-paper text-ink-soft hover:bg-canvas"
            }`}
          >
            Compare
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            <RotateCcw size={12} />
            Restore
          </button>
          <button
            onClick={ws.closeVersionPreview}
            aria-label="Back to current version"
            className="rounded-full border border-line bg-paper p-1.5 text-ink-soft transition-colors hover:bg-canvas"
          >
            <X size={13} />
          </button>
        </span>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={versionPreview.label ? `Restore “${versionPreview.label}”?` : "Restore this commit?"}
        message="The document goes back to this commit. Anything not committed will be replaced — commit the current version first if you want to keep it."
        confirmLabel="Restore"
        danger={false}
        busy={busy}
        onConfirm={async () => {
          if (busy) return;
          setBusy(true);
          await ws.restoreVersion();
          setBusy(false);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// Sticky bar shown over the document while proposed changes are previewed on
// the page. Apply/Dismiss act on the same pending change as the chat card.
function ReviewBar() {
  const ws = useWorkspace();
  const { pendingChange, pendingDeselected } = ws;
  const total = pendingChange?.edits?.length ?? 0;
  const selectable = !pendingChange?.edits?.some((op) => op.op === "setDocument");
  const selectedCount = selectable ? total - pendingDeselected.size : total;

  return (
    <div className="pointer-events-none sticky top-2.5 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-full border border-accent bg-paper py-1.5 pl-4 pr-1.5 shadow-pop">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-deep">
          <ShieldCheck size={15} />
          Reviewing changes
        </span>
        <span className="hidden text-[12px] text-muted sm:flex sm:items-center sm:gap-1.5">
          {selectable && total > 1 && `${selectedCount} of ${total} selected · `}
          <ins className="rounded-[3px] bg-[#e3f1e8] px-1 text-good no-underline">added</ins>
          <del className="rounded-[3px] bg-red-50 px-1 text-red-700 decoration-red-400">removed</del>
        </span>
        <span className="flex items-center gap-1.5">
          <button
            onClick={ws.approvePendingChange}
            disabled={!selectedCount}
            className={`rounded-full px-3.5 py-1 text-[12.5px] font-semibold text-white transition-colors ${
              selectedCount ? "bg-accent hover:bg-accent-deep" : "cursor-default bg-accent-disabled"
            }`}
          >
            {selectedCount === total
              ? total === 1
                ? "Apply"
                : "Apply all"
              : `Apply ${selectedCount}`}
          </button>
          <button
            onClick={ws.rejectPendingChange}
            className="rounded-full border border-line bg-paper px-3 py-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-canvas"
          >
            Dismiss
          </button>
        </span>
      </div>
    </div>
  );
}

// Compact find & replace card (Ctrl/Cmd+F). Owns the query state, feeds match
// decorations to the SearchHighlight plugin, and replaces via transactions so
// marks on surrounding text survive.
function FindReplacePanel({ editor, focusNonce, onClose }) {
  const [query, setQuery] = useState(() => {
    // Prefill from the current selection, like Google Docs.
    const { from, to, empty } = editor.state.selection;
    if (empty) return "";
    const text = editor.state.doc.textBetween(from, to, " ").trim();
    return text.length && text.length <= 80 ? text : "";
  });
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [active, setActive] = useState(-1);
  const [matchCount, setMatchCount] = useState(0);
  const matchesRef = useRef([]);
  const paramsRef = useRef({ query: "", caseSensitive: false, active: -1 });
  const suppressRef = useRef(false);
  const inputRef = useRef(null);

  const scrollToMatch = (match) => {
    if (!match) return;
    const dom = editor.view.domAtPos(match.from);
    const el = dom.node.nodeType === 1 ? dom.node : dom.node.parentElement;
    el?.scrollIntoView({ block: "center" });
  };

  // Recompute matches + decorations. activeIndex wraps in both directions.
  const applySearch = (q, cs, nextActive, scroll) => {
    const matches = findMatches(editor.state.doc, q, cs);
    const idx = matches.length ? ((nextActive % matches.length) + matches.length) % matches.length : -1;
    matchesRef.current = matches;
    paramsRef.current = { query: q, caseSensitive: cs, active: idx };
    suppressRef.current = true;
    editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, { matches, activeIndex: idx }));
    suppressRef.current = false;
    setMatchCount(matches.length);
    setActive(idx);
    if (scroll && idx >= 0) scrollToMatch(matches[idx]);
  };

  useEffect(() => {
    applySearch(query, caseSensitive, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive]);

  // Doc edited while the panel is open (typing, AI, replace) — recompute.
  useEffect(() => {
    const onUpdate = () => {
      if (suppressRef.current) return;
      const p = paramsRef.current;
      applySearch(p.query, p.caseSensitive, Math.max(p.active, 0), false);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      // Leaving the panel clears the highlights.
      editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, { matches: [], activeIndex: -1 }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusNonce]);

  const step = (dir) => applySearch(query, caseSensitive, (active < 0 ? 0 : active + dir), true);

  const replaceOne = () => {
    const match = matchesRef.current[active];
    if (!match) return;
    suppressRef.current = true;
    editor.view.dispatch(editor.state.tr.insertText(replaceText, match.from, match.to));
    suppressRef.current = false;
    // Land on the next match after the replacement (don't re-match inside it).
    const afterPos = match.from + replaceText.length;
    const fresh = findMatches(editor.state.doc, query, caseSensitive);
    const nextIdx = Math.max(0, fresh.findIndex((m) => m.from >= afterPos));
    applySearch(query, caseSensitive, fresh.length ? nextIdx : 0, true);
  };

  const replaceAll = () => {
    const matches = matchesRef.current;
    if (!matches.length) return;
    let tr = editor.state.tr;
    for (let i = matches.length - 1; i >= 0; i--) {
      tr = tr.insertText(replaceText, matches[i].from, matches[i].to);
    }
    suppressRef.current = true;
    editor.view.dispatch(tr);
    suppressRef.current = false;
    applySearch(query, caseSensitive, 0, false);
  };

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const onFindKeys = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="absolute right-3 top-3 z-30 w-[340px] max-w-[calc(100%-24px)] rounded-xl border border-line bg-paper p-2 shadow-pop">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFindKeys}
          placeholder="Find in document"
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <span className="w-12 shrink-0 text-center text-[11.5px] tabular-nums text-muted">
          {query ? (matchCount ? `${active + 1}/${matchCount}` : "0") : ""}
        </span>
        <button
          onClick={() => setCaseSensitive((v) => !v)}
          title="Match case"
          aria-pressed={caseSensitive}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            caseSensitive ? "bg-accent-soft text-accent-deep" : "text-ink-soft hover:bg-canvas"
          }`}
        >
          <CaseSensitive size={15} />
        </button>
        <button onClick={() => step(-1)} disabled={!matchCount} title="Previous match (Shift+Enter)" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35">
          <ArrowUp size={14} />
        </button>
        <button onClick={() => step(1)} disabled={!matchCount} title="Next match (Enter)" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35">
          <ArrowDown size={14} />
        </button>
        <button onClick={close} aria-label="Close find and replace" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas">
          <X size={14} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <input
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              replaceOne();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
          placeholder="Replace with"
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          onClick={replaceOne}
          disabled={!matchCount}
          className="h-8 shrink-0 rounded-md border border-line px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35"
        >
          Replace
        </button>
        <button
          onClick={replaceAll}
          disabled={!matchCount}
          className="h-8 shrink-0 rounded-md border border-line px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35"
        >
          All
        </button>
      </div>
    </div>
  );
}

// Heading outline — click to jump. Derived from the live doc on every edit.
function OutlinePanel({ editor, tick, onNavigate }) {
  const items = useMemo(() => {
    if (!editor) return [];
    const found = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading" && node.attrs.level <= 3 && node.textContent.trim()) {
        found.push({ level: node.attrs.level, text: node.textContent.trim(), pos });
      }
    });
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, tick]);

  return (
    <div className="absolute left-3 top-12 z-20 flex max-h-[65%] w-60 flex-col rounded-xl border border-line bg-paper shadow-pop">
      <p className="shrink-0 border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Outline
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length === 0 && (
          <p className="px-2 py-1.5 text-[12px] leading-relaxed text-muted">
            Add headings and they'll show up here.
          </p>
        )}
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onNavigate(item)}
            className={`block w-full truncate rounded-md py-1 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-canvas hover:text-ink ${
              item.level === 1 ? "pl-2 font-semibold text-ink" : item.level === 2 ? "pl-4" : "pl-6"
            } pr-2`}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EditorPane() {
  const ws = useWorkspace();
  const {
    activeDocId, docsVersion, docHtmlRef, editorApiRef, uploading,
    pendingChange, pendingDeselected, versionPreview,
  } = ws;

  const handlersRef = useRef({});
  handlersRef.current.onEditorUpdate = ws.onEditorUpdate;
  handlersRef.current.openFind = ws.openFind;
  handlersRef.current.closeFind = ws.closeFind;

  const suppressRef = useRef(false);
  const [zoom, setZoom] = useState("fit"); // 'fit' | number (percent)
  const [dragDepth, setDragDepth] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [tick, setTick] = useState(0); // re-render on editor create/update/selection
  const fileInputRef = useRef(null);

  // Find & replace open/focus state lives in the workspace context so the
  // Edit menu and Ctrl+F drive the same panel.
  const { findOpen, findNonce } = ws;
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [countMode, setCountMode] = useState("words"); // 'words' | 'chars' | 'charsNoSpaces'
  // Cmd/Ctrl+Shift+V just before a paste event → that paste is plain-text.
  const plainPasteAtRef = useRef(0);

  // Shared documents run on a CRDT so several people can type at once;
  // private ones keep the plain single-writer path with no network at all.
  const isShared = !!ws.activeDoc?.shared;
  const collab = useCollab({ documentId: activeDocId, enabled: isShared });
  const collabReady = isShared && collab.ready && collab.docId === activeDocId;
  const ydoc = collabReady ? collab.ydoc : null;
  const seededRef = useRef(null);

  useEffect(() => {
    ws.setPeers(isShared ? collab.peers : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShared, collab.peers]);

  const editor = useEditor({
    extensions: createExtensions({ ydoc }),
    immediatelyRender: false,
    editorProps: {
      attributes: { spellcheck: "true" },
      handlePaste: (view, event) => {
        if (Date.now() - plainPasteAtRef.current > 1000) return false;
        plainPasteAtRef.current = 0;
        const text = event.clipboardData?.getData("text/plain");
        if (text == null) return false;
        event.preventDefault();
        const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = text
          .split(/\r?\n\s*\r?\n/)
          .map((p) => `<p>${esc(p).replace(/\r?\n/g, "<br>")}</p>`)
          .join("");
        view.pasteHTML(html);
        return true;
      },
    },
    onCreate: () => setTick((t) => t + 1),
    onUpdate: ({ editor: ed }) => {
      if (suppressRef.current) return;
      handlersRef.current.onEditorUpdate?.(ed.getHTML());
      setTick((t) => t + 1);
    },
    onSelectionUpdate: () => setTick((t) => t + 1),
    onFocus: () => setEditorFocused(true),
    onBlur: () => setEditorFocused(false),
  }, [ydoc]);

  // Bridge the editor to the workspace context.
  useEffect(() => {
    if (!editor) return;
    editorApiRef.current = {
      editor,
      getHTML: () => editor.getHTML(),
      setContent: (html) => {
        suppressRef.current = true;
        editor.commands.setContent(html || "", { emitUpdate: false });
        suppressRef.current = false;
      },
      focus: () => editor.commands.focus(),
    };
    ws.setEditorInstance(editor);
    return () => {
      if (editorApiRef.current?.editor === editor) editorApiRef.current = null;
      ws.setEditorInstance((cur) => (cur === editor ? null : cur));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editorApiRef]);

  // Load content when the active document (or a programmatic rewrite) changes.
  // In collaborative mode the CRDT is the source of truth, so pushing HTML in
  // here would clobber whatever co-editors have already typed.
  useEffect(() => {
    // Switching collaboration on swaps the editor instance, so re-read it here
    // and skip an instance that is already on its way out.
    const ed = editor;
    if (!ed || ed.isDestroyed || ydoc) return;
    const target = activeDocId ? (docHtmlRef.current.get(activeDocId) ?? "") : "";
    if (ed.getHTML() === target) return;
    suppressRef.current = true;
    ed.commands.setContent(target, { emitUpdate: false });
    suppressRef.current = false;
    setTick((t) => t + 1);
  }, [editor, activeDocId, docsVersion, docHtmlRef, ydoc]);

  // First client into a newly shared document plants the existing content into
  // the empty CRDT; everyone after that receives it over the wire instead.
  useEffect(() => {
    const ed = editor;
    if (!ed || ed.isDestroyed || !ydoc || !collab.needsSeed) return;
    if (seededRef.current === activeDocId) return;
    const html = docHtmlRef.current.get(activeDocId) ?? "";
    if (!html) return;
    seededRef.current = activeDocId;
    ed.commands.setContent(html, { emitUpdate: true });
  }, [editor, ydoc, collab.needsSeed, activeDocId, docHtmlRef]);

  // Proposed changes render on the document itself while awaiting review —
  // but only on the document they were proposed for.
  const reviewing = !!pendingChange && (pendingChange.docId ?? null) === (activeDocId ?? null);
  // Base comes from docHtmlRef, not the editor: on a tab switch this memo runs
  // before the effect that loads the new doc into the editor, so the editor's
  // html can still be the previous tab's. docHtmlRef is kept current on every
  // keystroke and programmatic write.
  const reviewHtml = useMemo(() => {
    if (!reviewing) return null;
    const base = activeDocId ? (docHtmlRef.current.get(activeDocId) ?? "") : "";
    return buildDiffPreviewHtml(pendingChange.edits, base, pendingDeselected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, pendingChange, pendingDeselected, activeDocId]);

  // Commit preview — takes precedence over a pending-change review overlay.
  const previewingVersion = !!versionPreview && versionPreview.docId === activeDocId;
  const versionHtml = useMemo(() => {
    if (!previewingVersion) return null;
    if (!versionPreview.compare) return versionPreview.html;
    const current = activeDocId ? (docHtmlRef.current.get(activeDocId) ?? "") : "";
    return diffHtml(current, versionPreview.html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewingVersion, versionPreview, activeDocId]);

  const overlayHtml = previewingVersion ? versionHtml : reviewing ? reviewHtml : null;
  const overlayActive = overlayHtml != null;

  const isEmpty = !editor || editor.isEmpty;
  const showDropzone = !activeDocId && isEmpty && !uploading && !editorFocused && !overlayActive;

  // Ctrl/Cmd+F opens in-document find (browser find is useless inside the
  // scroll container). Typing in inputs elsewhere in the app is left alone.
  const overlayRef = useRef(false);
  overlayRef.current = overlayActive;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "f") return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (overlayRef.current) return;
      e.preventDefault();
      handlersRef.current.openFind?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The find panel and outline make no sense over a diff preview.
  useEffect(() => {
    if (overlayActive) {
      handlersRef.current.closeFind?.();
      setOutlineOpen(false);
    }
  }, [overlayActive]);

  /* ------------------------------ word count ------------------------------- */

  const wordsIn = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);
  const countLabel = (() => {
    if (!editor) return "";
    const doc = editor.state.doc;
    const docText = doc.textBetween(0, doc.content.size, " ");
    const { from, to, empty } = editor.state.selection;
    const selText = empty ? null : doc.textBetween(from, to, " ");
    if (countMode === "chars") {
      const total = docText.replace(/\s+/g, " ").trim().length;
      return selText
        ? `${selText.length.toLocaleString()} of ${total.toLocaleString()} characters`
        : `${total.toLocaleString()} characters`;
    }
    if (countMode === "charsNoSpaces") {
      const strip = (t) => t.replace(/\s/g, "").length;
      return selText
        ? `${strip(selText).toLocaleString()} of ${strip(docText).toLocaleString()} characters (no spaces)`
        : `${strip(docText).toLocaleString()} characters (no spaces)`;
    }
    return selText
      ? `${wordsIn(selText).toLocaleString()} of ${wordsIn(docText).toLocaleString()} words`
      : `${wordsIn(docText).toLocaleString()} words`;
  })();

  const jumpToHeading = (item) => {
    if (!editor) return;
    const dom = editor.view.nodeDOM(item.pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: "smooth", block: "start" });
    editor.chain().focus().setTextSelection(item.pos + 1).run();
  };

  /* ------------------------------ drag & drop ------------------------------ */

  const onDrop = (e) => {
    e.preventDefault();
    setDragDepth(0);
    if (e.dataTransfer?.files?.length) ws.uploadFiles(e.dataTransfer.files);
  };
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

  /* --------------------------------- zoom ---------------------------------- */

  const zoomValue = zoom === "fit" ? 100 : zoom;
  const stepZoom = (dir) => {
    const current = zoom === "fit" ? 100 : zoom;
    const idx = ZOOM_STEPS.findIndex((z) => z >= current);
    const at = idx === -1 ? ZOOM_STEPS.length - 1 : idx;
    const next = ZOOM_STEPS[Math.min(Math.max(at + dir, 0), ZOOM_STEPS.length - 1)];
    setZoom(next);
  };

  return (
    <section
      className="flex h-full min-w-0 flex-1 flex-col"
      onKeyDownCapture={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") {
          plainPasteAtRef.current = Date.now();
        }
      }}
    >
      <div className="relative min-h-0 flex-1">
        <div
          className="h-full overflow-y-auto"
          onDragEnter={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragDepth((d) => d + 1); } }}
          onDragLeave={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragDepth((d) => Math.max(0, d - 1)); } }}
          onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }}
          onDrop={onDrop}
        >
          {previewingVersion ? <VersionBar /> : reviewing && <ReviewBar />}
          <div
            style={{ zoom: zoomValue / 100 }}
            className={`px-3 py-6 md:px-10 md:py-8 ${showDropzone ? "mp-hide-placeholder" : ""}`}
          >
            <div
              className={`doc-editor mx-auto w-[850px] max-w-full rounded-[4px] bg-paper px-7 py-12 shadow-card ring-1 ring-line md:px-[88px] md:py-[76px] ${
                overlayActive ? "" : "cursor-text"
              }`}
              onClick={(e) => {
                if (!overlayActive && e.target === e.currentTarget) editor?.commands.focus("end");
              }}
            >
              {overlayActive && (
                <div className="tiptap diff-doc" dangerouslySetInnerHTML={{ __html: overlayHtml }} />
              )}
              <div className={overlayActive ? "hidden" : undefined}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>

        {editor && findOpen && !overlayActive && (
          <FindReplacePanel editor={editor} focusNonce={findNonce} onClose={ws.closeFind} />
        )}

        {editor && !overlayActive && !showDropzone && (
          <button
            onClick={() => setOutlineOpen((o) => !o)}
            title="Outline"
            aria-label="Toggle outline"
            aria-pressed={outlineOpen}
            className={`absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-line shadow-card transition-colors ${
              outlineOpen ? "bg-accent-soft text-accent-deep" : "bg-paper text-ink-soft hover:bg-canvas"
            }`}
          >
            <ListTree size={16} strokeWidth={2} />
          </button>
        )}
        {editor && outlineOpen && !overlayActive && !showDropzone && (
          <OutlinePanel editor={editor} tick={tick} onNavigate={jumpToHeading} />
        )}

        {editor && !isEmpty && !overlayActive && (
          <button
            onClick={() =>
              setCountMode((m) => (m === "words" ? "chars" : m === "chars" ? "charsNoSpaces" : "words"))
            }
            title="Click to switch between words and characters"
            className="absolute bottom-4 left-4 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink-soft shadow-card transition-colors hover:bg-canvas"
          >
            {countLabel}
          </button>
        )}

        {showDropzone && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center rounded-lg border-2 border-dashed border-line-strong bg-paper/60 px-8 py-14 text-center backdrop-blur-[1px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper shadow-card ring-1 ring-line">
                <FileText size={26} className="text-ink-soft" strokeWidth={1.8} />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink">Drop your document here</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                You can also click 📎 in the chat to attach,
                <br />
                or paste content directly
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink shadow-card transition-colors hover:bg-canvas"
              >
                <Upload size={15} strokeWidth={2} />
                Choose a file
              </button>
              <p className="mt-4 text-xs text-muted">
                Accepted formats: PDF, DOCX, TXT, RTF, MD, HTML · ≤ 30 MB
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-paper px-5 py-3.5 shadow-pop">
              <Loader2 size={18} className="animate-spin text-accent" />
              <span className="text-sm font-medium text-ink">Importing your document…</span>
            </div>
          </div>
        )}

        {dragDepth > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[3px] border-2 border-dashed border-accent bg-accent-soft/80">
            <p className="rounded-lg bg-paper px-4 py-2 text-sm font-semibold text-accent-deep shadow-card">
              Drop to upload
            </p>
          </div>
        )}

        {/* zoom control */}
        <div className="absolute bottom-4 right-4 flex items-center overflow-hidden rounded-md border border-line bg-paper shadow-card">
          <button
            onClick={() => stepZoom(-1)}
            aria-label="Zoom out"
            className="px-2.5 py-1.5 text-ink transition-colors hover:bg-canvas"
          >
            <Minus size={14} strokeWidth={2.2} />
          </button>
          <button
            onClick={() => setZoom("fit")}
            className="min-w-[52px] px-2 py-1.5 text-center text-[13px] font-semibold text-ink transition-colors hover:bg-canvas"
            title="Reset zoom"
          >
            {zoom === "fit" ? "Fit" : `${zoom}%`}
          </button>
          <button
            onClick={() => stepZoom(1)}
            aria-label="Zoom in"
            className="px-2.5 py-1.5 text-ink transition-colors hover:bg-canvas"
          >
            <Plus size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          ws.uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

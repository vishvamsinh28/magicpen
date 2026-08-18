"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import { useCollab } from "@/components/collab/useCollab";
import { createExtensions } from "./extensions";

/**
 * Creates the TipTap editor for the workspace and keeps it in sync with the
 * active document: loads content on tab switches, bridges the instance into
 * the workspace context (editorApiRef), and wires collaborative documents onto
 * a CRDT. Returns { editor, tick, editorFocused, plainPasteAtRef } where
 * `tick` bumps on create/update/selection so panels can re-derive doc state.
 */
export function useDocEditor(ws) {
  const { activeDocId, docsVersion, docHtmlRef, editorApiRef } = ws;

  // Latest autosave callback without re-creating the editor per render.
  const onEditorUpdateRef = useRef(null);
  onEditorUpdateRef.current = ws.onEditorUpdate;

  // Set while content is written programmatically so onUpdate stays quiet.
  const suppressRef = useRef(false);
  const [tick, setTick] = useState(0); // re-render on editor create/update/selection
  const [editorFocused, setEditorFocused] = useState(false);
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
      onEditorUpdateRef.current?.(ed.getHTML());
      setTick((t) => t + 1);
    },
    onSelectionUpdate: () => setTick((t) => t + 1),
    onFocus: () => setEditorFocused(true),
    onBlur: () => setEditorFocused(false),
  }, [ydoc]);

  // Write content without emitting an update; finally guards the suppress
  // flag so a setContent throw can never mute autosave for good.
  const writeQuietly = (ed, html) => {
    suppressRef.current = true;
    try {
      ed.commands.setContent(html, { emitUpdate: false });
    } finally {
      suppressRef.current = false;
    }
  };

  // Bridge the editor to the workspace context.
  useEffect(() => {
    if (!editor) return;
    editorApiRef.current = {
      editor,
      getHTML: () => editor.getHTML(),
      setContent: (html) => writeQuietly(editor, html || ""),
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
    writeQuietly(ed, target);
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

  return { editor, tick, editorFocused, plainPasteAtRef };
}

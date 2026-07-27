"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiFetch, deriveTitleFromHtml, downloadBlob } from "@/lib/client-utils";
import { htmlToBlocks, applyOpsToHtml, isHtmlEmpty, describeOps } from "@/components/editor/blocks";

const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);

const DEFAULT_SETTINGS = { mode: "balanced", autoApply: true };

export function WorkspaceProvider({ user, children }) {
  /* -------------------------------- account ------------------------------- */
  // The signed-in user, resolved by AppGate before the workspace mounts.

  const signOut = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/");
  };

  /* ------------------------------ documents ------------------------------ */
  const [openDocs, setOpenDocs] = useState([]); // [{id, title, sourceFile}]
  const [activeDocId, setActiveDocId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const docHtmlRef = useRef(new Map()); // id -> latest html
  const editorApiRef = useRef(null); // registered by EditorPane
  const saveTimersRef = useRef(new Map());
  const creatingFromTypingRef = useRef(false);
  const [docsVersion, setDocsVersion] = useState(0); // bump when html replaced programmatically

  /* -------------------------------- chat --------------------------------- */
  const [chatId, setChatId] = useState(null);
  const [chatTitle, setChatTitle] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [scope, setScope] = useState("document"); // 'document' | 'cross'
  const [pendingChange, setPendingChange] = useState(null);
  // Indices into pendingChange.edits the user unchecked during review.
  // Shared state: drives both the chat card and the in-document preview.
  const [pendingDeselected, setPendingDeselected] = useState(() => new Set());

  /* --------------------------------- ui ---------------------------------- */
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [leftView, setLeftView] = useState("chat"); // 'chat' | 'changes'
  const [mobilePane, setMobilePane] = useState("chat"); // 'chat' | 'editor'
  const [navOpen, setNavOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null); // 'upgrade'|'getstarted'|'docs'|'bug'|'settings'|'profile'
  const [toast, setToast] = useState(null);
  const [changesVersion, setChangesVersion] = useState(0);
  const [printHtml, setPrintHtml] = useState(null); // non-null while printing

  const toastTimerRef = useRef(null);
  const showToast = (message, type = "error") => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  };

  /* --------------------------- persistence bits --------------------------- */

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("superdocs-settings") || "null");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
    } catch {}
    // Restore this user's previously open tabs.
    (async () => {
      try {
        const tabs = JSON.parse(
          localStorage.getItem(`superdocs-tabs:${user.id}`) || "null"
        );
        if (!tabs?.ids?.length) return;
        const restored = [];
        for (const id of tabs.ids.slice(0, 8)) {
          try {
            const { document } = await apiFetch(`/api/documents/${id}`);
            docHtmlRef.current.set(document.id, document.contentHtml || "");
            restored.push({ id: document.id, title: document.title, sourceFile: document.sourceFile });
          } catch {}
        }
        if (restored.length) {
          setOpenDocs(restored);
          const active = restored.some((d) => d.id === tabs.activeId) ? tabs.activeId : restored[0].id;
          setActiveDocId(active);
          setMobilePane("editor");
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("superdocs-settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(
        `superdocs-tabs:${user.id}`,
        JSON.stringify({ ids: openDocs.map((d) => d.id), activeId: activeDocId })
      );
    } catch {}
  }, [openDocs, activeDocId, user]);

  /* ------------------------------ doc actions ----------------------------- */

  const tabMeta = (doc) => ({ id: doc.id, title: doc.title, sourceFile: doc.sourceFile || null });

  const addTab = (doc) =>
    setOpenDocs((prev) => (prev.some((d) => d.id === doc.id) ? prev : [...prev, tabMeta(doc)]));

  const scheduleSave = (docId) => {
    const timers = saveTimersRef.current;
    clearTimeout(timers.get(docId));
    timers.set(
      docId,
      setTimeout(async () => {
        timers.delete(docId);
        const html = docHtmlRef.current.get(docId);
        if (html == null) return;
        try {
          await apiFetch(`/api/documents/${docId}`, {
            method: "PATCH",
            body: JSON.stringify({ contentHtml: html }),
          });
        } catch (e) {
          showToast(`Autosave failed: ${e.message}`);
        }
      }, 900)
    );
  };

  // Called by the editor on every user edit.
  const onEditorUpdate = (html) => {
    const docId = activeDocId;
    if (docId) {
      docHtmlRef.current.set(docId, html);
      scheduleSave(docId);
      return;
    }
    // Typing/pasting into the empty workspace silently creates a document.
    if (!creatingFromTypingRef.current && !isHtmlEmpty(html)) {
      creatingFromTypingRef.current = true;
      (async () => {
        try {
          const { document } = await apiFetch("/api/documents", {
            method: "POST",
            body: JSON.stringify({ title: deriveTitleFromHtml(html), contentHtml: html }),
          });
          // Editor may have more content by now — keep the freshest html.
          const latest = editorApiRef.current?.getHTML() ?? html;
          docHtmlRef.current.set(document.id, latest);
          addTab(document);
          setActiveDocId(document.id);
          scheduleSave(document.id);
        } catch (e) {
          showToast(e.message);
        } finally {
          creatingFromTypingRef.current = false;
        }
      })();
    }
  };

  const openDocument = async (id) => {
    try {
      if (!docHtmlRef.current.has(id)) {
        const { document } = await apiFetch(`/api/documents/${id}`);
        docHtmlRef.current.set(id, document.contentHtml || "");
        addTab(document);
      }
      setActiveDocId(id);
      setMobilePane("editor");
      setFilesOpen(false);
    } catch (e) {
      showToast(e.message);
    }
  };

  const createBlankDocument = async () => {
    try {
      const { document } = await apiFetch("/api/documents", { method: "POST", body: "{}" });
      docHtmlRef.current.set(document.id, "");
      addTab(document);
      setActiveDocId(document.id);
      setMobilePane("editor");
      setFilesOpen(false);
      setTemplatesOpen(false);
      return document;
    } catch (e) {
      showToast(e.message);
      return null;
    }
  };

  const createDocumentFromTemplate = async (template) => {
    try {
      const { document } = await apiFetch("/api/documents", {
        method: "POST",
        body: JSON.stringify({ title: template.name, contentHtml: template.html }),
      });
      docHtmlRef.current.set(document.id, document.contentHtml || "");
      addTab(document);
      setActiveDocId(document.id);
      setDocsVersion((v) => v + 1);
      setMobilePane("editor");
      setTemplatesOpen(false);
    } catch (e) {
      showToast(e.message);
    }
  };

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        try {
          const form = new FormData();
          form.append("file", file);
          const { document, notice } = await apiFetch("/api/upload", { method: "POST", body: form });
          docHtmlRef.current.set(document.id, document.contentHtml || "");
          addTab(document);
          setActiveDocId(document.id);
          setDocsVersion((v) => v + 1);
          if (notice) showToast(notice, "info");
        } catch (e) {
          showToast(e.message);
        }
      }
      setMobilePane("editor");
    } finally {
      setUploading(false);
    }
  };

  const closeDocument = (id) => {
    setOpenDocs((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (activeDocId === id) {
        const idx = prev.findIndex((d) => d.id === id);
        const neighbor = next[idx] || next[idx - 1] || null;
        setActiveDocId(neighbor ? neighbor.id : null);
      }
      return next;
    });
  };

  const renameDocument = async (id, title) => {
    if (!title?.trim()) return false;
    try {
      await apiFetch(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setOpenDocs((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  const deleteDocument = async (id) => {
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      docHtmlRef.current.delete(id);
      closeDocument(id);
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  /* ----------------------------- applying edits --------------------------- */

  const recordChange = async (payload) => {
    try {
      await apiFetch("/api/changes", { method: "POST", body: JSON.stringify(payload) });
      setChangesVersion((v) => v + 1);
    } catch {}
  };

  // `docId` pins the edit to the document it was proposed for — without it the
  // edit lands on whatever tab is active (wrong after a mid-review tab switch).
  const applyEdits = async ({ edits, summary, chatId: sourceChatId, newTitle, docId: targetDocId }) => {
    let docId = targetDocId !== undefined ? targetDocId : activeDocId;
    const onActive = docId === activeDocId;
    const beforeHtml = docId
      ? onActive
        ? (editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "")
        : (docHtmlRef.current.get(docId) ?? "")
      : "";
    if (docId && !onActive && !docHtmlRef.current.has(docId)) {
      showToast("Open that document again to apply this change.");
      return false;
    }
    const afterHtml = applyOpsToHtml(beforeHtml, edits);

    try {
      if (!docId) {
        const title = newTitle || deriveTitleFromHtml(afterHtml);
        const { document } = await apiFetch("/api/documents", {
          method: "POST",
          body: JSON.stringify({ title, contentHtml: afterHtml }),
        });
        docId = document.id;
        docHtmlRef.current.set(docId, afterHtml);
        addTab(document);
        setActiveDocId(docId);
      } else {
        let appliedHtml = afterHtml;
        if (onActive) {
          editorApiRef.current?.setContent(afterHtml);
          // What the editor actually renders is the truth — if it matches the
          // original, the "edit" was invisible and we say so instead of lying.
          appliedHtml = editorApiRef.current?.getHTML() ?? afterHtml;
          if (edits.length && appliedHtml === beforeHtml) {
            showToast(
              "Those changes couldn't be applied — the formatting isn't supported. Try phrasing the request differently."
            );
            return false;
          }
        }
        docHtmlRef.current.set(docId, appliedHtml);
        const patch = { contentHtml: appliedHtml };
        if (newTitle) {
          patch.title = newTitle;
          setOpenDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, title: newTitle } : d)));
        }
        await apiFetch(`/api/documents/${docId}`, { method: "PATCH", body: JSON.stringify(patch) });
      }
      setDocsVersion((v) => v + 1);
      if (onActive) setMobilePane("editor");
      await recordChange({
        documentId: docId,
        chatId: sourceChatId || null,
        summary: summary || "AI edit",
        ops: edits,
        beforeHtml,
        afterHtml: onActive ? (editorApiRef.current?.getHTML() ?? afterHtml) : afterHtml,
        status: "applied",
      });
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  /* --------------------------------- chat --------------------------------- */

  const markMessage = (id, patch) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const sendMessage = async (text, attachments = []) => {
    const trimmed = text?.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setPendingChange(null);
    const localUser = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed,
      attachments: attachments.map((a) => ({ name: a.name })),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localUser]);

    const docId = activeDocId;
    const activeDoc = openDocs.find((d) => d.id === docId);
    const html = docId
      ? (editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "")
      : "";
    const blocks = docId && !isHtmlEmpty(html) ? htmlToBlocks(html) : [];

    try {
      const resp = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          chatId,
          documentId: docId,
          scope,
          message: trimmed,
          mode: settings.mode,
          blocks,
          docTitle: activeDoc?.title || "",
          attachments,
        }),
      });

      setChatId(resp.chat.id);
      setChatTitle(resp.chat.title);
      const assistant = { ...resp.assistantMessage, appliedStatus: null };
      const hasEdits = assistant.edits?.length > 0;

      if (hasEdits && settings.autoApply) {
        setMessages((prev) => [...prev, assistant]);
        const ok = await applyEdits({
          edits: assistant.edits,
          summary: assistant.editSummary,
          chatId: resp.chat.id,
          newTitle: resp.docTitle,
          docId,
        });
        markMessage(assistant.id, { appliedStatus: ok ? "applied" : "failed" });
      } else if (hasEdits) {
        assistant.appliedStatus = "pending";
        setMessages((prev) => [...prev, assistant]);
        setPendingDeselected(new Set());
        setPendingChange({
          messageId: assistant.id,
          edits: assistant.edits,
          summary: assistant.editSummary,
          chatId: resp.chat.id,
          newTitle: resp.docTitle,
          docId,
        });
        // The proposal renders on the document itself — surface it on mobile.
        setMobilePane("editor");
      } else {
        setMessages((prev) => [...prev, assistant]);
        if (resp.docTitle && docId) renameDocument(docId, resp.docTitle);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          error: true,
          content: e.message,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const togglePendingEdit = (i) =>
    setPendingDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const setPendingSelectAll = (selectAll, count) =>
    setPendingDeselected(selectAll ? new Set() : new Set(Array.from({ length: count }, (_, i) => i)));

  // Apply the reviewed change, minus whatever the user unchecked.
  const approvePendingChange = async () => {
    if (!pendingChange) return;
    const all = pendingChange.edits || [];
    const edits = all.filter((_, i) => !pendingDeselected.has(i));
    if (!edits.length) return;
    const partial = edits.length < all.length;
    // On a partial apply the AI's summary describes ops that were skipped —
    // relabel from the subset that actually lands.
    const summary = partial
      ? `${[...new Set(describeOps(edits).map((d) => d.label))].join(" · ")} (${edits.length} of ${all.length} edits)`
      : pendingChange.summary;
    const ok = await applyEdits({ ...pendingChange, edits, summary });
    markMessage(pendingChange.messageId, {
      appliedStatus: ok ? (partial ? "partial" : "applied") : "failed",
      appliedInfo: ok && partial ? { applied: edits.length, total: all.length } : null,
    });
    setPendingChange(null);
    setPendingDeselected(new Set());
  };

  const rejectPendingChange = async () => {
    if (!pendingChange) return;
    const docId = pendingChange.docId ?? activeDocId;
    if (docId) {
      const current =
        docId === activeDocId
          ? (editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "")
          : (docHtmlRef.current.get(docId) ?? "");
      await recordChange({
        documentId: docId,
        chatId: pendingChange.chatId,
        summary: pendingChange.summary || "AI edit",
        ops: pendingChange.edits,
        beforeHtml: current,
        afterHtml: "",
        status: "rejected",
      });
    }
    markMessage(pendingChange.messageId, { appliedStatus: "rejected" });
    setPendingChange(null);
    setPendingDeselected(new Set());
  };

  const newConversation = () => {
    setChatId(null);
    setChatTitle(null);
    setMessages([]);
    setPendingChange(null);
    setLeftView("chat");
    setMobilePane("chat");
  };

  const loadChat = async (id) => {
    try {
      const { chat, messages: msgs } = await apiFetch(`/api/chats/${id}`);
      setChatId(chat.id);
      setChatTitle(chat.title);
      setScope(chat.scope || "document");
      setMessages(msgs.map((m) => ({ ...m, appliedStatus: m.edits?.length ? "applied" : null })));
      setPendingChange(null);
      setLeftView("chat");
      setHistoryOpen(false);
      setMobilePane("chat");
      if (chat.documentId && chat.documentId !== activeDocId) {
        openDocument(chat.documentId).catch(() => {});
      }
    } catch (e) {
      showToast(e.message);
    }
  };

  const deleteChat = async (id) => {
    try {
      await apiFetch(`/api/chats/${id}`, { method: "DELETE" });
      if (id === chatId) newConversation();
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    }
  };

  const restoreChange = async (change) => {
    const docId = activeDocId;
    if (!docId) return;
    const current = editorApiRef.current?.getHTML() ?? "";
    docHtmlRef.current.set(docId, change.beforeHtml);
    editorApiRef.current?.setContent(change.beforeHtml);
    setDocsVersion((v) => v + 1);
    try {
      await apiFetch(`/api/documents/${docId}`, {
        method: "PATCH",
        body: JSON.stringify({ contentHtml: change.beforeHtml }),
      });
      await recordChange({
        documentId: docId,
        chatId: change.chatId,
        summary: `Restored to before “${change.summary}”`,
        ops: [],
        beforeHtml: current,
        afterHtml: change.beforeHtml,
        status: "restored",
      });
    } catch (e) {
      showToast(e.message);
    }
  };

  /* -------------------------------- export -------------------------------- */

  const downloadDocument = async (format = "docx") => {
    const docId = activeDocId;
    if (!docId) return;
    if (format === "pdf") {
      // Rendered by PrintSheet, which triggers window.print() once mounted.
      setPrintHtml(editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "");
      return;
    }
    const activeDoc = openDocs.find((d) => d.id === docId);
    const html = editorApiRef.current?.getHTML() ?? docHtmlRef.current.get(docId) ?? "";
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: activeDoc?.title || "document", html, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Export failed");
      }
      const blob = await res.blob();
      const ext = { docx: "docx", md: "md", html: "html", txt: "txt" }[format] || format;
      downloadBlob(blob, `${(activeDoc?.title || "document").replace(/[\\/:*?"<>|]+/g, "")}.${ext}`);
    } catch (e) {
      showToast(e.message);
    }
  };

  const value = {
    // account
    user, signOut,
    // documents
    openDocs, activeDocId, activeDoc: openDocs.find((d) => d.id === activeDocId) || null,
    uploading, docsVersion, docHtmlRef, editorApiRef,
    openDocument, createBlankDocument, createDocumentFromTemplate, uploadFiles,
    closeDocument, renameDocument, deleteDocument, onEditorUpdate,
    // chat
    chatId, chatTitle, messages, sending, scope, setScope, pendingChange,
    pendingDeselected, togglePendingEdit, setPendingSelectAll,
    sendMessage, approvePendingChange, rejectPendingChange, newConversation, loadChat, deleteChat,
    // changes
    changesVersion, restoreChange, applyEdits,
    // export & print
    downloadDocument, printHtml, setPrintHtml,
    // settings & ui
    settings, setSettings,
    leftView, setLeftView, mobilePane, setMobilePane,
    navOpen, setNavOpen, filesOpen, setFilesOpen, templatesOpen, setTemplatesOpen,
    historyOpen, setHistoryOpen, infoModal, setInfoModal,
    toast, showToast,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

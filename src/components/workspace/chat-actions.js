import { apiFetch } from "@/lib/client-utils";
import { htmlToBlocks, isHtmlEmpty } from "@/components/editor/blocks";

/**
 * Conversation actions: sending a message (and routing any returned edits to
 * auto-apply or the review flow), plus loading/creating/deleting chats.
 * Factory (no hooks) recreated each provider render.
 */
export function createChatActions({
  chatId, setChatId, setChatTitle, setMessages, sending, setSending,
  scope, setScope, settings, activeDocId, openDocs, docHtmlRef, editorApiRef,
  setPendingChange, setPendingDeselected, setMobilePane,
  applyEdits, renameDocument, openDocument, openPanel, showToast,
}) {
  /** Patches one message in place (by id) — used to track applied status. */
  const markMessage = (id, patch) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  // Sends the user's message with the active document's blocks as context.
  // Edits in the reply either auto-apply (per settings) or become the pending
  // review; API failures surface as an error bubble in the thread, not a toast.
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

  /** Clears the thread and starts fresh (any pending review is dropped). */
  const newConversation = () => {
    setChatId(null);
    setChatTitle(null);
    setMessages([]);
    setPendingChange(null);
    openPanel("chat");
  };

  /** Loads a past chat into the panel and re-opens its document if needed. */
  const loadChat = async (id) => {
    try {
      const { chat, messages: msgs } = await apiFetch(`/api/chats/${id}`);
      setChatId(chat.id);
      setChatTitle(chat.title);
      setScope(chat.scope || "document");
      setMessages(msgs.map((m) => ({ ...m, appliedStatus: m.edits?.length ? "applied" : null })));
      setPendingChange(null);
      openPanel("chat");
      if (chat.documentId && chat.documentId !== activeDocId) {
        // openDocument toasts its own failures; the catch is belt-and-braces.
        openDocument(chat.documentId).catch(() => {});
      }
    } catch (e) {
      showToast(e.message);
    }
  };

  /** Deletes a chat; deleting the one on screen resets to a new conversation. */
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

  return { markMessage, sendMessage, newConversation, loadChat, deleteChat };
}

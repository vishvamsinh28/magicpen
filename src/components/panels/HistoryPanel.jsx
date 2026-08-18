"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Trash2, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiFetch } from "@/lib/client-utils";
import { PanelHeader, PanelSearch } from "./PanelChrome";
import HistoryChatRow from "./HistoryChatRow";

/**
 * Past conversations as a right-side panel (same shell as the other panels —
 * no overlay). Picking a chat loads it and lands on the AI assistant panel.
 * Rows support single and batch delete; ws.deleteChat surfaces its own errors
 * and returns a boolean, so the list only drops chats that really deleted.
 */
export default function HistoryPanel() {
  const ws = useWorkspace();
  const [chats, setChats] = useState(null);
  const [query, setQuery] = useState("");
  const [confirmChat, setConfirmChat] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    apiFetch("/api/chats")
      .then((data) => setChats(data.chats))
      .catch((e) => {
        ws.showToast(e.message);
        setChats([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = (chats || []).filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase().trim())
  );

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const open = (chat) => {
    ws.loadChat(chat.id);
    ws.openPanel("chat");
  };

  // Batch delete: only chats whose delete succeeded leave the selection and
  // the list, so a partial failure keeps the failed rows visible.
  const removeSelected = async () => {
    if (batchDeleting || selected.size === 0) return;
    setBatchDeleting(true);
    const ids = [...selected];
    const results = await Promise.all(ids.map((id) => ws.deleteChat(id)));
    const gone = new Set(ids.filter((_, i) => results[i]));
    setBatchDeleting(false);
    setConfirmBatch(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of gone) next.delete(id);
      return next;
    });
    if (gone.size) setChats((prev) => prev?.filter((c) => !gone.has(c.id)));
  };

  const remove = async () => {
    const chat = confirmChat;
    if (!chat || deleting) return;
    setDeleting(true);
    const ok = await ws.deleteChat(chat.id);
    setDeleting(false);
    setConfirmChat(null);
    if (ok) setChats((prev) => prev?.filter((c) => c.id !== chat.id));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <PanelHeader
        gap
        icon={<MessageSquare size={15} className="shrink-0 text-accent" />}
        title="Chat history"
        onClose={ws.closePanel}
      />

      <PanelSearch value={query} onChange={setQuery} placeholder="Search chats..." />

      {selected.size > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line/70 px-3 pb-2">
          <span className="text-[12.5px] font-semibold text-ink">{selected.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-line-strong bg-paper px-2 py-1 text-[12px] font-semibold text-ink transition-colors hover:bg-canvas"
          >
            Cancel
          </button>
          <button
            onClick={() => setConfirmBatch(true)}
            className="flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-red-700"
          >
            <Trash2 size={11} />
            Delete
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {chats === null && (
          <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading chats…
          </p>
        )}
        {chats !== null && filtered.length === 0 && (
          <p className="px-4 py-3 text-[13px] leading-relaxed text-muted">
            {query
              ? "No chats match your search."
              : "No conversations yet — send your first message and it will be saved here."}
          </p>
        )}
        {filtered.map((chat) => (
          <HistoryChatRow
            key={chat.id}
            chat={chat}
            active={chat.id === ws.chatId}
            checked={selected.has(chat.id)}
            selectionMode={selected.size > 0}
            onOpen={() => open(chat)}
            onToggle={() => toggleSelect(chat.id)}
            onDelete={() => setConfirmChat(chat)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmChat}
        title={`Delete chat "${confirmChat?.title}"?`}
        message="Its messages will be gone for good."
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmChat(null)}
      />

      <ConfirmDialog
        open={confirmBatch}
        title={`Delete ${selected.size} ${selected.size === 1 ? "chat" : "chats"}?`}
        message="Their messages will be gone for good."
        busy={batchDeleting}
        onConfirm={removeSelected}
        onCancel={() => setConfirmBatch(false)}
      />
    </div>
  );
}

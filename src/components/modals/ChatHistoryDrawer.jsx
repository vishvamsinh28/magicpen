"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Search, X, Check, Trash2, Loader2, Waypoints } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiFetch, timeAgo } from "@/lib/client-utils";

export default function ChatHistoryDrawer() {
  const ws = useWorkspace();
  const [chats, setChats] = useState(null);
  const [query, setQuery] = useState("");
  const [confirmChat, setConfirmChat] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    if (!ws.historyOpen) return;
    setChats(null);
    setQuery("");
    setSelected(new Set());
    setConfirmBatch(false);
    apiFetch("/api/chats")
      .then((data) => setChats(data.chats))
      .catch((e) => {
        ws.showToast(e.message);
        setChats([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.historyOpen]);

  if (!ws.historyOpen) return null;

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
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-ink/30" onClick={() => ws.setHistoryOpen(false)} />
      <div className="sd-slide-in-left absolute bottom-0 left-0 top-0 flex w-[400px] max-w-[92vw] flex-col bg-cream shadow-pop">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <span className="flex items-center gap-2.5 text-[17px] font-bold text-ink">
            <MessageSquare size={18} strokeWidth={2} />
            Chat History
          </span>
          <button
            onClick={() => ws.setHistoryOpen(false)}
            aria-label="Close chat history"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-md border-[1.5px] border-frame bg-paper px-3 py-2">
            <Search size={15} className="shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 border-b border-line/70 px-4 pb-3">
            <span className="text-[13px] font-semibold text-ink">{selected.size} selected</span>
            <button
              onClick={() => setSelected(new Set(filtered.map((c) => c.id)))}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:bg-paper"
            >
              Select all
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg border-[1.5px] border-frame bg-paper px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-cream"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirmBatch(true)}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[12.5px] font-semibold text-white shadow-card transition-colors hover:bg-red-700"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          {chats === null && (
            <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading chats…
            </p>
          )}
          {chats !== null && filtered.length === 0 && (
            <p className="px-5 py-4 text-[13px] leading-relaxed text-muted">
              {query ? "No chats match your search." : "No conversations yet — send your first message and it will be saved here."}
            </p>
          )}
          {filtered.map((chat) => (
            <div
              key={chat.id}
              onClick={() => (selected.size > 0 ? toggleSelect(chat.id) : ws.loadChat(chat.id))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                (selected.size > 0 ? toggleSelect(chat.id) : ws.loadChat(chat.id))
              }
              className={`group flex cursor-pointer items-start gap-2.5 border-b border-line/70 px-5 py-3.5 transition-colors ${
                chat.id === ws.chatId ? "bg-accent-soft" : "hover:bg-paper"
              }`}
            >
              <button
                aria-label={selected.has(chat.id) ? `Deselect chat ${chat.title}` : `Select chat ${chat.title}`}
                aria-pressed={selected.has(chat.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(chat.id);
                }}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-[1.5px] transition-opacity ${
                  selected.has(chat.id)
                    ? "border-accent bg-accent text-white"
                    : `border-frame bg-paper text-transparent hover:text-muted ${
                        selected.size > 0 ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      }`
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium text-ink">{chat.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                  {chat.scope === "cross" && <Waypoints size={11} />}
                  {timeAgo(chat.updatedAt)}
                </p>
              </div>
              <button
                aria-label={`Delete chat ${chat.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmChat(chat);
                }}
                className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-cream hover:text-red-600 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
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

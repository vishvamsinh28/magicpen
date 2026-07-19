"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Search, X, Trash2, Loader2, Waypoints } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiFetch, timeAgo } from "@/lib/client-utils";

export default function ChatHistoryDrawer() {
  const ws = useWorkspace();
  const [chats, setChats] = useState(null);
  const [query, setQuery] = useState("");
  const [confirmChat, setConfirmChat] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!ws.historyOpen) return;
    setChats(null);
    setQuery("");
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
              onClick={() => ws.loadChat(chat.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && ws.loadChat(chat.id)}
              className={`group flex cursor-pointer items-start justify-between gap-2 border-b border-line/70 px-5 py-3.5 transition-colors ${
                chat.id === ws.chatId ? "bg-accent-soft" : "hover:bg-paper"
              }`}
            >
              <div className="min-w-0">
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
    </div>
  );
}

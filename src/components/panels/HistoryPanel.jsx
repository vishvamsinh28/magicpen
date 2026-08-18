"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Search, X, Check, Trash2, Loader2, Waypoints } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiFetch, timeAgo } from "@/lib/client-utils";

// Past conversations as a right-side panel (same shell as the other panels —
// no overlay). Picking a chat loads it and lands on the AI assistant panel.
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
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-line py-2 pl-3 pr-2">
        <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-ink">
          <MessageSquare size={15} className="shrink-0 text-accent" />
          Chat history
        </span>
        <button
          onClick={ws.closePanel}
          title="Close panel"
          aria-label="Close panel"
          className="shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-2 rounded-full border border-line-strong bg-paper px-3 py-1.5">
          <Search size={14} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </div>
      </div>

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
          <div
            key={chat.id}
            onClick={() => (selected.size > 0 ? toggleSelect(chat.id) : open(chat))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" && (selected.size > 0 ? toggleSelect(chat.id) : open(chat))
            }
            className={`group flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 transition-colors ${
              chat.id === ws.chatId ? "bg-accent-soft" : "hover:bg-canvas"
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
                  : `border-line-strong bg-paper text-transparent hover:text-muted ${
                      selected.size > 0 ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    }`
              }`}
            >
              <Check size={12} strokeWidth={3} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink">{chat.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
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
              className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-canvas hover:text-red-600 group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
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

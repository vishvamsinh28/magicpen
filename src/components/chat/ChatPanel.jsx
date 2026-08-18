"use client";

import { useEffect, useRef } from "react";
import { Plus, X, Waypoints, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";
import WelcomeCard from "./WelcomeCard";
import MessageBubble, { TypingBubble } from "./MessageBubble";
import PendingChangeCard from "./PendingChangeCard";
import Composer from "./Composer";

/**
 * The AI assistant panel: header with new-conversation / scope / close
 * controls, the transcript (welcome card while empty, typing and review
 * states), and the composer. Auto-scrolls to the bottom on new activity.
 */
export default function ChatPanel() {
  const ws = useWorkspace();
  const { messages, sending, scope, setScope, pendingChange } = ws;
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!messages.length) return; // keep the welcome card at the top
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, pendingChange]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      {/* panel header */}
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-line py-2 pl-3 pr-2">
        <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-ink">
          <Sparkles size={15} className="shrink-0 text-accent" />
          AI assistant
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={ws.newConversation}
            title="New conversation"
            aria-label="New conversation"
            className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
          >
            <Plus size={16} strokeWidth={2.2} />
          </button>
          <Dropdown
            align="right"
            items={[
              {
                label: "This document",
                desc: "Conversation tied to the open document",
                active: scope === "document",
                onSelect: () => setScope("document"),
              },
              {
                label: "Cross-session",
                desc: "Continues across documents and sessions",
                active: scope === "cross",
                onSelect: () => setScope("cross"),
              },
            ]}
            trigger={
              <button
                title={scope === "cross" ? "Scope: cross-session" : "Scope: this document"}
                aria-label="Conversation scope"
                className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink data-[open]:bg-canvas"
              >
                <Waypoints size={15} />
              </button>
            }
          />
          <button
            onClick={ws.closePanel}
            title="Close panel"
            aria-label="Close panel"
            className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* messages + composer */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3.5">
        {messages.length === 0 && <WelcomeCard />}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {sending && <TypingBubble />}
        {!sending && pendingChange && <PendingChangeCard key={pendingChange.messageId} />}
      </div>
      <div className="shrink-0 border-t border-line" />
      <Composer />
    </div>
  );
}

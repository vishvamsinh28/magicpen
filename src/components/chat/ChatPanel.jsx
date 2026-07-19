"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus, ChevronDown, ChevronUp, ArrowUp, Paperclip, Shield, ShieldCheck,
  Loader2, X, Waypoints, Scale, TriangleAlert, Pencil, FilePlus2, FileMinus2,
  FileText, Check,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch } from "@/lib/client-utils";

const MODES = {
  precise: { label: "Precise", desc: "Sticks closely to your wording" },
  balanced: { label: "Balanced", desc: "Good default for most edits" },
  creative: { label: "Creative", desc: "Freer rewrites and new ideas" },
};

const OP_ICONS = {
  replace: <Pencil size={11} />,
  insertAfter: <FilePlus2 size={11} />,
  insertBefore: <FilePlus2 size={11} />,
  delete: <FileMinus2 size={11} />,
  setDocument: <FileText size={11} />,
};

function opLabel(op) {
  switch (op.op) {
    case "replace": return `Edited block ${op.index + 1}`;
    case "insertAfter":
    case "insertBefore": return "Added content";
    case "delete": return `Removed block ${op.index + 1}`;
    case "setDocument": return "Wrote document";
    default: return op.op;
  }
}

function WelcomeCard() {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4 text-[13px] leading-relaxed shadow-card">
      <p className="text-[14px] font-bold text-ink">👋 Welcome to SuperDocs</p>
      <p className="text-[12.5px] text-muted">Your AI document assistant</p>

      <p className="mt-3.5 font-semibold text-ink">Get started</p>
      <div className="mt-1 space-y-1 text-ink-soft">
        <p><strong className="text-ink">Upload</strong> — click the Upload button above the editor</p>
        <p><strong className="text-ink">Paste</strong> — paste your text directly into the editor on the right</p>
        <p><strong className="text-ink">Template</strong> — <em>&quot;load the NDA template&quot;</em></p>
        <p><strong className="text-ink">Create</strong> — <em>&quot;create a rent agreement&quot;</em></p>
      </div>

      <p className="mt-3.5 font-semibold text-ink">What I can do</p>
      <p className="mt-1 text-ink-soft">
        Tell me what you want changed — I can edit any part of your document however
        you&apos;d like. Rewrite sections, fix grammar, translate, restructure, highlight
        text, change formatting, add or remove content.
      </p>

      <p className="mt-3.5 font-semibold text-ink">Tips</p>
      <div className="mt-1 space-y-1 text-ink-soft">
        <p><strong className="text-ink">Review Mode</strong> — toggle the shield icon below to approve changes before they&apos;re applied</p>
        <p><strong className="text-ink">Changes</strong> — track all edits in the Changes tab on the left panel</p>
        <p><strong className="text-ink">Attach</strong> — click 📎 below to add reference files as context for your edits</p>
      </div>

      <p className="mt-3.5 border-t border-line pt-3 text-[12.5px] text-muted">
        Your document goes in the <strong className="text-ink-soft">editor on the right</strong>.
        Use this chat for instructions.
      </p>
    </div>
  );
}

function EditChips({ edits, status }) {
  if (!edits?.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
      {edits.slice(0, 6).map((op, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-cream px-2 py-0.5 text-[11px] text-ink-soft"
        >
          {OP_ICONS[op.op]}
          {opLabel(op)}
        </span>
      ))}
      {edits.length > 6 && (
        <span className="text-[11px] text-muted">+{edits.length - 6} more</span>
      )}
      {status === "applied" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f3ec] px-2 py-0.5 text-[11px] font-medium text-good">
          <Check size={11} strokeWidth={3} /> Applied
        </span>
      )}
      {status === "pending" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          Awaiting review
        </span>
      )}
      {status === "rejected" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium text-muted">
          Dismissed
        </span>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md border border-accent-faint bg-accent-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
          {message.attachments?.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {message.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md border border-accent-faint bg-paper px-1.5 py-0.5 text-[11px] text-ink-soft">
                  <Paperclip size={10} /> {a.name}
                </span>
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800">
        <p className="flex items-start gap-2">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{message.content}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3 text-[13.5px] leading-relaxed text-ink shadow-card">
      <p className="whitespace-pre-wrap">{message.content}</p>
      <EditChips edits={message.edits} status={message.appliedStatus} />
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex w-fit items-center gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3 shadow-card">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="sd-dot h-1.5 w-1.5 rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="text-[12.5px] text-muted">Working on it…</span>
    </div>
  );
}

function PendingChangeCard() {
  const ws = useWorkspace();
  const { pendingChange } = ws;
  if (!pendingChange) return null;
  return (
    <div className="sd-pop-in rounded-2xl border-[1.5px] border-accent bg-accent-soft p-3.5">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-accent-deep">
        <ShieldCheck size={16} /> Review proposed changes
      </p>
      {pendingChange.summary && (
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{pendingChange.summary}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {pendingChange.edits.slice(0, 6).map((op, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full border border-accent-faint bg-paper px-2 py-0.5 text-[11px] text-ink-soft">
            {OP_ICONS[op.op]} {opLabel(op)}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={ws.approvePendingChange}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep"
        >
          Apply changes
        </button>
        <button
          onClick={ws.rejectPendingChange}
          className="rounded-lg border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-cream"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function Composer() {
  const ws = useWorkspace();
  const { settings, setSettings, sending } = ws;
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]); // {name, text, loading}
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  const canSend = text.trim().length > 0 && !sending && !attachments.some((a) => a.loading);

  const send = () => {
    if (!canSend) return;
    ws.sendMessage(text, attachments.filter((a) => !a.loading && !a.error));
    setText("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const autoGrow = (el) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
  };

  const addAttachments = async (files) => {
    for (const file of Array.from(files || [])) {
      const entry = { name: file.name, text: "", loading: true };
      setAttachments((prev) => [...prev, entry]);
      try {
        const form = new FormData();
        form.append("file", file);
        const { attachment } = await apiFetch("/api/attachments", { method: "POST", body: form });
        setAttachments((prev) =>
          prev.map((a) => (a === entry ? { ...attachment, loading: false } : a))
        );
      } catch (e) {
        ws.showToast(e.message);
        setAttachments((prev) => prev.filter((a) => a !== entry));
      }
    }
  };

  return (
    <div className="shrink-0 px-3 pb-2.5 pt-2">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-cream px-2 py-1 text-[11.5px] text-ink-soft">
              {a.loading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
              <span className="max-w-36 truncate">{a.name}</span>
              <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-ink">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 rounded-lg border-[1.5px] border-frame bg-paper px-3 py-2 transition-shadow focus-within:shadow-card">
          <textarea
            ref={textareaRef}
            rows={2}
            value={text}
            placeholder="Type your message... (Shift+Enter for new line)"
            onChange={(e) => {
              setText(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="block w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          onClick={send}
          disabled={!canSend}
          aria-label="Send message"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all ${
            canSend
              ? "border-accent-deep bg-accent text-white shadow-card hover:bg-accent-deep"
              : "border-line bg-paper text-muted"
          }`}
        >
          {sending ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.4} />}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-0.5">
        <button
          onClick={() => fileRef.current?.click()}
          title="Attach a reference file"
          className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink"
        >
          <Paperclip size={15} />
        </button>

        <Dropdown
          direction="up"
          items={Object.entries(MODES).map(([key, m]) => ({
            label: m.label,
            desc: m.desc,
            active: settings.mode === key,
            onSelect: () => setSettings((s) => ({ ...s, mode: key })),
          }))}
          trigger={
            <button className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-cream">
              <Scale size={13} />
              {MODES[settings.mode]?.label || "Balanced"}
              <ChevronUp size={12} className="text-muted" />
            </button>
          }
        />

        <button
          onClick={() => setSettings((s) => ({ ...s, autoApply: !s.autoApply }))}
          title={
            settings.autoApply
              ? "Auto-apply is on — click to review changes before they're applied"
              : "Review Mode is on — you approve every change"
          }
          className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium transition-colors ${
            settings.autoApply
              ? "text-ink-soft hover:bg-cream"
              : "bg-accent-soft text-accent-deep"
          }`}
        >
          {settings.autoApply ? <Shield size={13} /> : <ShieldCheck size={13} />}
          {settings.autoApply ? "Auto-apply" : "Review"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.rtf,.md,.markdown,.html,.htm"
        className="hidden"
        onChange={(e) => {
          addAttachments(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

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
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* panel header */}
      <div className="flex shrink-0 items-center justify-between rounded-[5px] border-[1.5px] border-frame bg-paper py-1 pl-2 pr-2">
        <button
          onClick={ws.newConversation}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-cream"
        >
          <Plus size={16} strokeWidth={2.2} />
          New conversation
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
            <button className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-cream">
              <Waypoints size={14} />
              {scope === "cross" ? "Cross-session" : "This document"}
              <ChevronDown size={13} className="text-muted" />
            </button>
          }
        />
      </div>

      {/* messages + composer */}
      <div className="flex min-h-0 flex-1 flex-col rounded-[5px] border-[1.5px] border-frame bg-paper">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3.5">
          {messages.length === 0 && <WelcomeCard />}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {sending && <TypingBubble />}
          {!sending && pendingChange && <PendingChangeCard />}
        </div>
        <div className="shrink-0 border-t border-line" />
        <Composer />
      </div>
    </div>
  );
}

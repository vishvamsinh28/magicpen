"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, ChevronUp, ArrowUp, Paperclip, Shield, ShieldCheck,
  Loader2, X, Waypoints, Scale, TriangleAlert, Pencil, FilePlus2, FileMinus2,
  FileText, Check, Sparkles,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";
import DiffList from "@/components/DiffView";
import { apiFetch } from "@/lib/client-utils";
import { buildDiffItems } from "@/lib/diff";

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

// Empty-conversation state: a short greeting and clickable starter prompts
// that prefill the composer (via the mp-chat-prefill event Composer listens
// for), plus two one-line hints about the controls right below them.
function WelcomeCard() {
  const starters = [
    "load the meeting notes template",
    "draft a press release for our launch",
    "make the intro half as long",
    "turn the bullet points into a table",
  ];
  const pick = (s) => window.dispatchEvent(new CustomEvent("mp-chat-prefill", { detail: s }));
  return (
    <div className="px-1 pb-2 pt-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Sparkles size={22} strokeWidth={2} />
      </span>
      <p className="font-display mt-3.5 text-[16.5px] font-bold tracking-tight text-ink">
        What should we write?
      </p>
      <p className="mx-auto mt-1.5 max-w-[270px] text-[12.5px] leading-relaxed text-muted">
        Drop a file on the page, paste text, or describe the document you need — then
        tell me what to change. I only touch the part you point at.
      </p>

      <div className="mt-5 space-y-1.5">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => pick(s)}
            className="block w-full rounded-lg border border-line bg-paper px-3 py-2 text-left text-[12.5px] text-ink-soft shadow-card transition-colors hover:border-accent-faint hover:bg-accent-soft/40 hover:text-ink"
          >
            “{s}”
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2 border-t border-line pt-4 text-left">
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
          <Shield size={13} className="mt-0.5 shrink-0" />
          <span>
            The shield below turns on <strong className="font-semibold text-ink-soft">Review Mode</strong> —
            every edit waits for your approval.
          </span>
        </p>
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
          <Paperclip size={13} className="mt-0.5 shrink-0" />
          <span>
            Attach reference files for context; <strong className="font-semibold text-ink-soft">View → AI changes</strong> lists
            every edit with undo.
          </span>
        </p>
      </div>
    </div>
  );
}

function EditChips({ edits, status, info }) {
  if (!edits?.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
      {edits.slice(0, 6).map((op, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] text-ink-soft"
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
      {status === "partial" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f3ec] px-2 py-0.5 text-[11px] font-medium text-good">
          <Check size={11} strokeWidth={3} />
          Applied {info ? `${info.applied} of ${info.total}` : "selected"}
        </span>
      )}
      {status === "pending" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          Awaiting review
        </span>
      )}
      {status === "rejected" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
          Dismissed
        </span>
      )}
      {status === "failed" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
          <TriangleAlert size={11} /> Couldn&apos;t apply
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
      <EditChips edits={message.edits} status={message.appliedStatus} info={message.appliedInfo} />
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
            className="mp-dot h-1.5 w-1.5 rounded-full bg-accent"
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
  const { pendingChange, pendingDeselected: deselected, docHtmlRef } = ws;

  // Diff against the document the proposal was made for — the same html
  // applyEdits will transform. docHtmlRef (not the editor) is the source of
  // truth: it's current on every keystroke and safe across tab switches.
  const items = useMemo(() => {
    if (!pendingChange) return [];
    const docId = pendingChange.docId ?? null;
    const html = docId ? (docHtmlRef.current.get(docId) ?? "") : "";
    return buildDiffItems(pendingChange.edits, html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChange]);

  if (!pendingChange) return null;

  // A setDocument rewrite has no per-op mapping — it's apply-all or dismiss.
  const selectable = items.length > 0 && items.every((it) => it.opRef);
  const total = items.length;
  const selectedCount = selectable ? total - deselected.size : total;

  return (
    <div className="mp-pop-in rounded-2xl border-[1.5px] border-accent bg-accent-soft p-3.5">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-accent-deep">
        <ShieldCheck size={16} /> Review proposed changes
      </p>
      {pendingChange.summary && (
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{pendingChange.summary}</p>
      )}

      {selectable && total > 1 && (
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-muted">
            {selectedCount} of {total} selected
          </span>
          <button
            onClick={() => ws.setPendingSelectAll(deselected.size > 0, total)}
            className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-accent-deep transition-colors hover:bg-accent-faint"
          >
            {deselected.size ? "Select all" : "Clear all"}
          </button>
        </div>
      )}

      <div className={`${selectable && total > 1 ? "mt-1.5" : "mt-2.5"} max-h-[45vh] overflow-y-auto pr-0.5`}>
        <DiffList items={items} selectable={selectable} deselected={deselected} onToggle={ws.togglePendingEdit} />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={ws.approvePendingChange}
          disabled={!selectedCount}
          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-card transition-colors ${
            selectedCount ? "bg-accent hover:bg-accent-deep" : "cursor-default bg-accent-disabled"
          }`}
        >
          {selectedCount === total
            ? total === 1
              ? "Apply"
              : "Apply all"
            : `Apply ${selectedCount} selected`}
        </button>
        <button
          onClick={ws.rejectPendingChange}
          className="rounded-lg border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-canvas"
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

  // Starter prompts in the welcome card prefill the composer through this
  // event so the two components stay decoupled.
  useEffect(() => {
    const onPrefill = (e) => {
      setText(e.detail || "");
      const el = textareaRef.current;
      if (el) {
        el.focus();
        requestAnimationFrame(() => autoGrow(el));
      }
    };
    window.addEventListener("mp-chat-prefill", onPrefill);
    return () => window.removeEventListener("mp-chat-prefill", onPrefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <span key={i} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-[11.5px] text-ink-soft">
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
        <div className="min-w-0 flex-1 rounded-lg border border-line-strong bg-paper px-3 py-2 transition-colors focus-within:border-accent">
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
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all ${
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
          className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
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
            <button className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-canvas">
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
              ? "text-ink-soft hover:bg-canvas"
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

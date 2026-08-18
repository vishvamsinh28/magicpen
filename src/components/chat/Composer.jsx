"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronUp, ArrowUp, Paperclip, Shield, ShieldCheck, Loader2, X, Scale,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch } from "@/lib/client-utils";

// Edit-style presets for the mode dropdown; keys are the values sent to the API.
const MODES = {
  precise: { label: "Precise", desc: "Sticks closely to your wording" },
  balanced: { label: "Balanced", desc: "Good default for most edits" },
  creative: { label: "Creative", desc: "Freer rewrites and new ideas" },
};

/**
 * Message input row: auto-growing textarea, attachment upload chips, and the
 * mode / review-toggle controls. Attachments upload to /api/attachments as
 * they are picked; only finished, error-free ones are included in the send.
 * Also the listener side of the "mp-chat-prefill" event WelcomeCard dispatches.
 */
export default function Composer() {
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

  // Uploads run one file at a time; a failed upload drops its chip and
  // surfaces the error as a toast rather than blocking the others.
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

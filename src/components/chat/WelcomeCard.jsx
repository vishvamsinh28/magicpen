"use client";

import { Paperclip, Shield, Sparkles } from "lucide-react";

/**
 * Empty-conversation state: a short greeting, clickable starter prompts, and
 * two one-line hints about the composer controls below. Starters prefill the
 * composer via the "mp-chat-prefill" window event Composer listens for, which
 * keeps the two components decoupled.
 */
export default function WelcomeCard() {
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

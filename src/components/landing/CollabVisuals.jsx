/**
 * Static mocks for the sharing and version-control showcases: the share-link
 * dialog with live presence, and the Review Mode commit timeline.
 */

import { Check, ChevronDown, Copy, GitCommit, Link2, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import { Frame } from "./Primitives";

/**
 * Share dialog mock: link row, role and download controls, live presence
 * avatars, and an anchored comment thread with a resolve action.
 */
export function ShareVisual() {
  return (
    <Frame
      label={
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Link2 size={13} className="text-accent" />
          <span className="text-[12.5px] font-semibold">Share · Offer Letter</span>
        </div>
      }
    >
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-[5px] border border-line bg-canvas px-2.5 py-1.5 font-mono text-[11px] text-ink-soft">
            magicpen.app/d/8fKq2Rv…
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-[5px] border-[1.5px] border-line-strong bg-paper px-2.5 py-1.5 text-[11.5px] font-semibold">
            <Copy size={11} />
            Copy
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-[5px] border border-line bg-paper px-2 py-1 text-[11.5px] font-medium text-ink">
            Can edit
            <ChevronDown size={11} className="text-muted" />
          </span>
          <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
            Downloads on
          </span>
          <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
            No account needed
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
          <span className="flex -space-x-1.5">
            {[["#1a73e8", "P"], ["#e8710a", "M"], ["#9334e6", "J"]].map(([bg, ch]) => (
              <span
                key={ch}
                className="flex h-[20px] w-[20px] items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-paper"
                style={{ background: bg }}
              >
                {ch}
              </span>
            ))}
          </span>
          <span className="text-[11.5px] text-ink-soft">3 people in the document now</span>
        </div>

        <div className="mt-3 rounded-[6px] border border-line bg-canvas p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
            <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#e8710a] text-[8px] font-bold text-white">
              M
            </span>
            Maya
            <span className="font-normal text-muted">· on “effective immediately”</span>
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
            Legal wants a start date here instead — can you swap it?
          </p>
          <span className="mt-2 flex w-fit items-center gap-1 rounded-[4px] border border-line bg-paper px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft">
            <Check size={10} strokeWidth={3} />
            Resolve
          </span>
        </div>
      </div>
    </Frame>
  );
}

/**
 * Review Mode mock: the apply/dismiss banner over a commit timeline with
 * one-click restore, plus the change-log footnote.
 */
export function ControlVisual() {
  const commits = [
    { label: "Sent to legal", time: "2 hours ago", restore: true },
    { label: "Before AI cleanup", time: "Yesterday, 18:40" },
    { label: "First draft", time: "Mon, 09:12" },
  ];

  return (
    <Frame
      label={
        <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-4 py-2.5">
          <ShieldCheck size={14} className="text-accent-deep" />
          <span className="text-[12px] font-semibold text-ink">Review Mode · 1 change waiting</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="rounded-[4px] bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white">
              Apply
            </span>
            <span className="rounded-[4px] border border-line bg-paper px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft">
              Dismiss
            </span>
          </span>
        </div>
      }
    >
      <div className="px-4 py-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          <GitCommit size={12} />
          Commits
        </p>

        <div className="mt-3.5 space-y-0.5">
          {commits.map((c, i) => (
            <div key={c.label} className="flex gap-3">
              <div className="flex w-3 shrink-0 flex-col items-center">
                <span
                  className={`mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full ${
                    i === 0 ? "bg-accent ring-4 ring-accent-faint" : "bg-line ring-2 ring-paper"
                  }`}
                />
                {i < commits.length - 1 && <span className="w-px flex-1 bg-line" />}
              </div>
              <div className="flex min-w-0 flex-1 items-start gap-2 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-ink">{c.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{c.time}</p>
                </div>
                {c.restore && (
                  <span className="flex shrink-0 items-center gap-1 rounded-[4px] border border-line bg-paper px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft">
                    <RotateCcw size={10} />
                    Restore
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[11.5px] text-muted">
          <Undo2 size={12} />
          Every AI change is also logged with a before / after snapshot.
        </p>
      </div>
    </Frame>
  );
}

/**
 * Static mocks of the two integration surfaces: a Slack DM with the MagicPen
 * bot, and the Google Docs sidebar add-on. Slack's aubergine header and the
 * Docs chrome colours are brand-accurate and intentionally hardcoded.
 */

import { Check, FileText, Send } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { DocsMark, SlackMark } from "./BrandMarks";
import { Bar, Frame } from "./Primitives";

/**
 * Slack DM mock: a slash command, the bot's reply, and a thread showing an
 * edit request, the returned file, and a :commit: snapshot action.
 */
export function SlackVisual() {
  const Code = ({ children }) => (
    <code className="rounded-[4px] border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink">
      {children}
    </code>
  );

  return (
    <Frame
      label={
        <div className="flex items-center gap-2 bg-[#3f0e40] px-4 py-2.5 text-white">
          <SlackMark size={15} />
          <span className="text-[12.5px] font-bold">MagicPen</span>
          <span className="rounded-[3px] bg-white/15 px-1 py-px text-[8.5px] font-bold uppercase tracking-wide">
            App
          </span>
          <span className="ml-auto text-[11px] text-white/45">Direct message</span>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-4">
        <div className="flex gap-2.5">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-accent text-[10px] font-bold text-white">
            V
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold">
              Vishva <span className="ml-1 font-normal text-muted">10:02</span>
            </p>
            <p className="mt-1">
              <Code>/magicpen new offer letter</Code>
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-canvas ring-1 ring-line">
            <LogoMark size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold">
              MagicPen
              <span className="ml-1 rounded-[3px] bg-line px-1 py-px text-[8.5px] font-bold uppercase tracking-wide text-ink-soft">
                App
              </span>
              <span className="ml-1.5 font-normal text-muted">10:02</span>
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              📄 <span className="font-semibold text-ink">Offer Letter</span> is ready — reply in
              this thread to edit it.
            </p>

            <div className="mt-3 space-y-3 border-l-2 border-line pl-3">
              <p className="text-[12px] leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">Vishva</span> add a 90-day review clause
              </p>
              <div>
                <p className="text-[12px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">MagicPen</span> Added a “Review Period”
                  section after the compensation clause.
                </p>
                <span className="mt-2 flex w-fit items-center gap-1.5 rounded-[5px] border border-line bg-canvas px-2 py-1 text-[11px] font-medium text-ink-soft">
                  <FileText size={11} className="text-accent" />
                  Offer Letter.docx
                </span>
              </div>
              <p className="text-[12px] text-ink-soft">
                <span className="font-semibold text-ink">Vishva</span>{" "}
                <Code>:commit: sent to legal</Code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/**
 * Google Docs mock: the doc canvas with a highlighted selection beside the
 * MagicPen sidebar, illustrating selection-scoped edits.
 */
export function DocsVisual() {
  return (
    <Frame
      label={
        <div className="border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2">
            <DocsMark size={17} />
            <span className="text-[12.5px] font-semibold">Offer Letter</span>
          </div>
          <div className="mt-1.5 flex gap-3 pl-[25px] text-[10.5px] text-muted">
            {["File", "Edit", "View", "Insert", "Format", "Tools"].map((m) => (
              <span key={m}>{m}</span>
            ))}
            <span className="rounded-[3px] bg-accent-soft px-1 font-semibold text-accent-deep">
              Extensions
            </span>
          </div>
        </div>
      }
    >
      <div className="flex bg-canvas-deep">
        <div className="hidden min-w-0 flex-1 p-4 sm:block">
          <div className="h-full rounded-[3px] bg-paper px-4 py-4 shadow-card">
            <div className="h-[8px] w-2/5 rounded-full bg-ink/25" />
            <div className="mt-3.5 space-y-2.5">
              <Bar w="100%" />
              <Bar w="88%" />
            </div>
            <p className="mt-4 rounded-[2px] bg-[#d7e5fb] px-1 py-0.5 text-[11px] leading-[1.8] text-ink">
              The Employee shall be entitled to twenty (20) days of paid leave per annum, accrued
              monthly.
            </p>
            <div className="mt-4 space-y-2.5">
              <Bar w="94%" />
              <Bar w="63%" />
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 border-l border-line bg-paper p-3.5 sm:w-[212px]">
          <div className="flex items-center gap-1.5">
            <LogoMark size={17} />
            <span className="text-[12px] font-bold">MagicPen</span>
          </div>
          <div className="mt-3 rounded-[5px] border-[1.5px] border-line-strong bg-canvas px-2.5 py-2 text-[11.5px] leading-relaxed text-ink">
            Rewrite this clause in plain English
            <span className="ml-px inline-block h-[13px] w-px translate-y-[2px] bg-accent" />
          </div>
          <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[5px] bg-accent py-2 text-[12px] font-semibold text-white">
            <Send size={12} />
            Send
          </button>
          <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted">
            <Check size={11} strokeWidth={3} className="mt-px shrink-0 text-good" />
            Text is selected — only that paragraph will change.
          </p>
        </div>
      </div>
    </Frame>
  );
}

/**
 * Static mock visuals for the hero and the template-gallery showcase. These
 * are hand-built illustrations of the product (styled markup, not
 * screenshots), so every string and colour in them is part of the approved
 * design.
 */

import { Check, ClipboardList, FileText, Megaphone, ReceiptText, Sparkles, UserRound } from "lucide-react";
import { Bar, Frame } from "./Primitives";

/* Word-level insert / delete mark styles for the mock diffs. The hex values
   are part of the approved design; keep them exact. */
const INS = "rounded-[3px] bg-[#e3f1e8] px-1 text-good";
const DEL = "rounded-[3px] bg-[#fdeeee] px-1 text-[#b91c1c] line-through decoration-[#f0a3a3]";

/**
 * Hero illustration: a mock offer letter showing one word-level diff, with a
 * floating prompt bubble and an "edited" receipt chip pinned to its corners.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:mx-0">
      <div
        aria-hidden
        className="absolute inset-x-0 -inset-y-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(26,115,232,0.14),transparent)] blur-2xl"
      />

      <Frame
        className="rotate-[-1.1deg]"
        label={
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <FileText size={13} className="text-muted" />
            <span className="text-[11.5px] font-semibold text-ink-soft">Offer Letter</span>
            <span className="ml-auto flex -space-x-1.5">
              {[["#1a73e8", "P"], ["#6d28d9", "M"], ["#e8710a", "J"]].map(([bg, ch]) => (
                <span
                  key={ch}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8.5px] font-bold text-white ring-2 ring-paper"
                  style={{ background: bg }}
                >
                  {ch}
                </span>
              ))}
            </span>
          </div>
        }
      >
        <div className="px-6 py-7 sm:px-8">
          <p className="text-[16px] font-bold tracking-tight">Offer of Employment</p>
          <p className="mt-4 text-[12.5px] leading-[1.9] text-ink-soft">
            Dear Priya,{" "}
            <span className={DEL}>we’re super excited to</span>{" "}
            <span className={INS}>it is our pleasure to formally</span> extend an offer for the
            position of Senior Product Designer at Northwind Studio.
          </p>
          <div className="mt-6 space-y-2.5">
            <Bar w="100%" />
            <Bar w="94%" />
            <Bar w="97%" />
            <Bar w="61%" />
          </div>
          <div className="mt-6 h-[9px] w-1/4 rounded-full bg-ink/25" />
          <div className="mt-3.5 space-y-2.5">
            <Bar w="88%" />
            <Bar w="96%" />
          </div>
        </div>
      </Frame>

      <div className="absolute -bottom-5 -left-3 rotate-[1.6deg] rounded-[7px] rounded-bl-[2px] bg-ink px-3.5 py-2.5 text-[12.5px] font-medium text-white shadow-pop sm:-left-6">
        Make the opening more formal
      </div>

      <div className="absolute -bottom-4 -right-2 flex rotate-[-1.4deg] items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink shadow-card sm:-right-5">
        <Check size={11} strokeWidth={3.2} className="text-good" />
        1 block edited
      </div>
    </div>
  );
}

/**
 * Template gallery mock for the use-cases showcase: four starter-template
 * cards plus the "start from a sentence" footer hint.
 */
export function GalleryVisual() {
  const cards = [
    { icon: <ClipboardList size={15} />, name: "Meeting notes", bars: ["88%", "64%"] },
    { icon: <Megaphone size={15} />, name: "Press release", bars: ["92%", "70%"] },
    { icon: <ReceiptText size={15} />, name: "Invoice", bars: ["76%", "58%"] },
    { icon: <UserRound size={15} />, name: "Resume", bars: ["84%", "66%"] },
  ];

  return (
    <Frame
      label={
        <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5 text-[11px] font-semibold text-muted">
          Start from a template
          <span className="ml-auto flex items-center gap-1.5 text-ink-soft">
            <Sparkles size={11} className="text-accent" />
            or a single sentence
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 p-4">
        {cards.map((card) => (
          <div
            key={card.name}
            className="rounded-lg border border-line bg-canvas/60 p-3.5 transition-colors hover:border-accent-faint"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent-deep">
              {card.icon}
            </span>
            <p className="mt-2.5 text-[12.5px] font-semibold text-ink">{card.name}</p>
            <div className="mt-2 space-y-1.5">
              {card.bars.map((w) => (
                <Bar key={w} w={w} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-line bg-canvas px-4 py-2.5 text-[11.5px] text-muted">
        …or type <span className="font-medium text-ink-soft">“draft a press release for our launch”</span> and start from that.
      </p>
    </Frame>
  );
}

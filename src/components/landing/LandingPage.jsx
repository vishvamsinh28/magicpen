import Link from "next/link";
import {
  ArrowRight, Check, Copy, ChevronDown, Link2, GitCommit, ShieldCheck,
  RotateCcw, FileText, Sparkles, Undo2, Send,
} from "lucide-react";
import Logo, { LogoMark } from "@/components/Logo";

/* --------------------------------- marks ---------------------------------- */
/* Lucide dropped brand glyphs, so the two integrations get hand-drawn marks.
   Slack's is a pinwheel: one pill rotated four times about the centre. */

function SlackMark({ size = 20 }) {
  const pill = { x: 11.6, y: 4.2, width: 10.6, height: 5.6, rx: 2.8 };
  const colors = ["#36C5F0", "#2EB67D", "#ECB22E", "#E01E5A"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {colors.map((fill, i) => (
        <rect key={fill} {...pill} fill={fill} transform={`rotate(${i * 90} 12 12)`} />
      ))}
    </svg>
  );
}

function DocsMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.5 2.5h8.2L19 7.9v13.6H5.5z" fill="#3086F6" />
      <path d="M13.7 2.5 19 7.9h-5.3z" fill="#0C67D6" />
      <path d="M8.4 11.4h8.2M8.4 14.2h8.2M8.4 17h5.4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------- primitives -------------------------------- */

function Eyebrow({ children }) {
  return (
    <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      <span aria-hidden className="h-px w-7 bg-accent" />
      {children}
    </p>
  );
}

function Bullets({ items }) {
  return (
    <ul className="mt-7 space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-soft">
          <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* A mock chrome that borrows the app's own panel frame. */
function Frame({ children, className = "", label }) {
  return (
    <div className={`overflow-hidden rounded-[7px] border-[1.5px] border-frame bg-paper shadow-pop ${className}`}>
      {label}
      {children}
    </div>
  );
}

function Showcase({ id, eyebrow, title, lede, items, visual, flip = false, tone = "cream" }) {
  return (
    <section
      id={id}
      className={`scroll-mt-16 border-t border-line ${tone === "paper" ? "bg-paper" : "bg-cream"}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
        <div className={`sd-reveal ${flip ? "lg:order-2" : ""}`}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-5 max-w-lg text-[clamp(1.65rem,3.4vw,2.35rem)] font-bold leading-[1.15] tracking-[-0.02em]">
            {title}
          </h2>
          <p className="mt-4 max-w-lg text-[15.5px] leading-[1.7] text-ink-soft">{lede}</p>
          <Bullets items={items} />
        </div>
        <div className={`sd-reveal ${flip ? "lg:order-1" : ""}`}>{visual}</div>
      </div>
    </section>
  );
}

/* --------------------------------- mockups --------------------------------- */

const INS = "rounded-[3px] bg-[#e3f1e8] px-1 text-good";
const DEL = "rounded-[3px] bg-[#fdeeee] px-1 text-[#b91c1c] line-through decoration-[#f0a3a3]";

function Bar({ w, tone = "line" }) {
  return <div className={`h-[6px] rounded-full ${tone === "line" ? "bg-line" : "bg-accent-faint"}`} style={{ width: w }} />;
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:mx-0">
      <div
        aria-hidden
        className="absolute inset-x-0 -inset-y-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(232,104,74,0.16),transparent)] blur-2xl"
      />

      <Frame
        className="rotate-[-1.1deg]"
        label={
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <FileText size={13} className="text-muted" />
            <span className="text-[11.5px] font-semibold text-ink-soft">Offer Letter</span>
            <span className="ml-auto flex -space-x-1.5">
              {[["#e8684a", "P"], ["#1d63d8", "M"], ["#1e7f4f", "J"]].map(([bg, ch]) => (
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

      <div className="absolute -bottom-4 -right-2 flex rotate-[-1.4deg] items-center gap-1.5 rounded-full border-[1.5px] border-frame bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink shadow-card sm:-right-5">
        <Check size={11} strokeWidth={3.2} className="text-good" />
        1 block edited
      </div>
    </div>
  );
}

function BlocksVisual() {
  const rows = [
    { n: 1, node: <p className="text-[14px] font-bold tracking-tight">Mutual NDA</p> },
    { n: 2, node: <div className="space-y-2.5 py-1"><Bar w="100%" /><Bar w="92%" /><Bar w="70%" /></div> },
    {
      n: 3,
      op: "replace",
      node: (
        <p className="text-[12px] leading-[1.85] text-ink-soft">
          Confidential Information shall be held in confidence for{" "}
          <span className={DEL}>two (2) years</span> <span className={INS}>five (5) years</span> from
          the Effective Date.
        </p>
      ),
    },
    { n: 4, node: <div className="space-y-2.5 py-1"><Bar w="96%" /><Bar w="55%" /></div> },
  ];

  return (
    <Frame
      label={
        <div className="flex items-center gap-2 border-b border-line bg-cream px-4 py-2.5 text-[11px] font-semibold text-muted">
          <span className="font-mono tracking-tight">blocks[]</span>
          <span className="ml-auto flex items-center gap-1.5 text-ink-soft">
            <Sparkles size={11} className="text-accent" />
            1 operation returned
          </span>
        </div>
      }
    >
      <div className="divide-y divide-line/70">
        {rows.map((row) => (
          <div
            key={row.n}
            className={`flex items-start gap-3.5 px-4 py-3.5 ${row.op ? "bg-accent-soft" : ""}`}
          >
            <span
              className={`mt-0.5 w-5 shrink-0 text-right font-mono text-[10px] ${
                row.op ? "text-accent-deep" : "text-muted"
              }`}
            >
              {row.n}
            </span>
            <div className="min-w-0 flex-1">{row.node}</div>
            {row.op && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-white">
                {row.op}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="border-t border-line bg-cream px-4 py-2.5 text-[11.5px] text-muted">
        Blocks 1, 2 and 4 are written back byte-for-byte.
      </p>
    </Frame>
  );
}

function SlackVisual() {
  const Code = ({ children }) => (
    <code className="rounded-[4px] border border-line bg-cream px-1.5 py-0.5 font-mono text-[11px] text-ink">
      {children}
    </code>
  );

  return (
    <Frame
      label={
        <div className="flex items-center gap-2 bg-[#3f0e40] px-4 py-2.5 text-white">
          <SlackMark size={15} />
          <span className="text-[12.5px] font-bold">SuperDocs</span>
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
              <Code>/superdoc new offer letter</Code>
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-cream ring-1 ring-line">
            <LogoMark size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold">
              SuperDocs
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
                  <span className="font-semibold text-ink">SuperDocs</span> Added a “Review Period”
                  section after the compensation clause.
                </p>
                <span className="mt-2 flex w-fit items-center gap-1.5 rounded-[5px] border border-line bg-cream px-2 py-1 text-[11px] font-medium text-ink-soft">
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

function DocsVisual() {
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
      <div className="flex bg-parchment">
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
            <span className="text-[12px] font-bold">SuperDocs</span>
          </div>
          <div className="mt-3 rounded-[5px] border-[1.5px] border-frame bg-cream px-2.5 py-2 text-[11.5px] leading-relaxed text-ink">
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

function ShareVisual() {
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
          <span className="min-w-0 flex-1 truncate rounded-[5px] border border-line bg-cream px-2.5 py-1.5 font-mono text-[11px] text-ink-soft">
            superdocs.app/d/8fKq2Rv…
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-[5px] border-[1.5px] border-frame bg-paper px-2.5 py-1.5 text-[11.5px] font-semibold">
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
            {[["#e8684a", "P"], ["#1d63d8", "M"], ["#7c3aed", "J"]].map(([bg, ch]) => (
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

        <div className="mt-3 rounded-[6px] border border-line bg-cream p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
            <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#1d63d8] text-[8px] font-bold text-white">
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

function ControlVisual() {
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

/* ---------------------------------- data ----------------------------------- */

const SPECS = [
  {
    term: "Import",
    def: "PDF, DOCX, TXT, RTF, Markdown and HTML up to 30 MB. Headings, tables, lists, links and images come through intact.",
  },
  {
    term: "Export",
    def: "Word (.docx), Markdown, HTML, plain text — or print straight to PDF with real document typography.",
  },
  {
    term: "Templates",
    def: "NDA, rent agreement, cover letter, meeting notes, proposal, invoice and résumé — or ask the assistant to draft one.",
  },
  {
    term: "Editor",
    def: "Tables, images, checklists, highlights, text alignment, page breaks, find and replace, zoom, and multi-document tabs.",
  },
  {
    term: "Chat",
    def: "Per-document chat history, plus reference attachments you can drop in when the assistant needs extra context.",
  },
  {
    term: "Privacy",
    def: "First-party accounts with scrypt-hashed passwords and httpOnly session cookies. Every document, chat and change is scoped to you.",
  },
];

/* ---------------------------------- page ----------------------------------- */

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <Logo />
          <nav className="flex items-center gap-1 md:gap-2">
            {[
              ["How it works", "#how"],
              ["Slack", "#slack"],
              ["Google Docs", "#gdocs"],
              ["Sharing", "#sharing"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="hidden rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink lg:block"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className="ml-1 whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:px-8 md:pb-28 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="sd-pop-in">
          <Eyebrow>AI document editor</Eyebrow>
          <h1 className="mt-6 text-[clamp(2.35rem,4.9vw,3.2rem)] font-bold leading-[1.08] tracking-[-0.03em]">
            Say what to change.{" "}
            {/* highlighter underline that survives a line break, unlike an
                absolutely-positioned bar */}
            <span className="[-webkit-box-decoration-break:clone] [box-decoration-break:clone] bg-[linear-gradient(to_top,#fbe3da_0.36em,transparent_0.36em)]">
              Nothing else moves.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-[16.5px] leading-[1.7] text-ink-soft md:text-[17.5px]">
            SuperDocs opens your document in a real editor and rewrites only the blocks you asked
            about. Your headings, tables, links and footnotes come out exactly as they went in — and
            you leave with <span className="font-semibold text-ink">a real file</span>, not a chat
            transcript.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep"
            >
              Start free
              <ArrowRight size={16} />
            </Link>
            <a
              href="#how"
              className="rounded-lg border-[1.5px] border-frame bg-paper px-6 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-cream"
            >
              See how it works
            </a>
          </div>
          <p className="mt-5 text-[13px] text-muted">
            Free to use · no credit card · your documents stay private to your account
          </p>
        </div>

        <HeroVisual />
      </section>

      {/* integrations strip */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:gap-10 md:px-8">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Works where the document already lives
          </p>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[14px] font-semibold text-ink">
            <span className="flex items-center gap-2">
              <LogoMark size={20} />
              SuperDocs web
            </span>
            <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
            <span className="flex items-center gap-2">
              <SlackMark size={18} />
              Slack
            </span>
            <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
            <span className="flex items-center gap-2">
              <DocsMark size={18} />
              Google Docs
            </span>
            <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
            <span className="flex items-center gap-2 font-medium text-ink-soft">
              <Link2 size={17} className="text-muted" />
              Share links
            </span>
          </div>
        </div>
      </section>

      <Showcase
        id="how"
        eyebrow="How it works"
        title="The model edits blocks. It never retypes your document."
        lede="Your file is split into numbered top-level blocks. The assistant answers with operations — replace block 3, insert after block 7, delete block 9 — and only those blocks are rewritten. Everything it didn’t name is written back untouched."
        items={[
          "Plain English is the interface: “tighten the intro”, “add a termination clause”, “translate to Spanish”.",
          "No copy-paste laundering — tables, footnotes and formatting never make the round trip.",
          "Every operation is sanitised, saved and recorded so you can undo it.",
        ]}
        visual={<BlocksVisual />}
      />

      <Showcase
        id="slack"
        eyebrow="New · Slack"
        title="Write, edit and send documents without leaving the thread."
        lede="Install the bot, connect your account once, and every document gets its own Slack thread. Reply to the thread to edit it; the updated file is posted straight back into the conversation."
        tone="paper"
        flip
        items={[
          <>
            <span className="font-semibold text-ink">/superdoc new</span> to create,{" "}
            <span className="font-semibold text-ink">list</span> and{" "}
            <span className="font-semibold text-ink">open</span> to pick up an existing document.
          </>,
          "Drag a document into the chat and the bot imports it for you.",
          <>
            Thread actions: <span className="font-semibold text-ink">:commit:</span> to snapshot,{" "}
            <span className="font-semibold text-ink">:undo:</span> to revert,{" "}
            <span className="font-semibold text-ink">:send:</span> for the file as docx, md, html or txt.
          </>,
          "Ask questions about the document too — “what’s in this doc?”, “summarise the key points”.",
        ]}
        visual={<SlackVisual />}
      />

      <Showcase
        id="gdocs"
        eyebrow="New · Google Docs"
        title="A SuperDocs sidebar inside the doc you’re already in."
        lede="Add the SuperDocs add-on, open Extensions → SuperDocs, and ask for the edit. It reads the open document, runs the same assistant, and writes the result straight back into the page."
        items={[
          "Selection-first: highlight a paragraph and only that paragraph changes. Highlight nothing and it works on the whole document.",
          "One-time account link, so it’s the same SuperDocs account as the web app and Slack.",
          "Nothing to copy out and nothing to paste back in.",
        ]}
        visual={<DocsVisual />}
      />

      <Showcase
        id="sharing"
        eyebrow="New · Sharing & collaboration"
        title="One link. View, comment, or edit together — live."
        lede="Create a share link per document and decide exactly what it grants. Guests don’t need an account, and everyone edits the same document at once with live cursors and presence."
        tone="paper"
        flip
        items={[
          "Three roles: can view, can comment, can edit — changeable after the fact.",
          "Comments anchor to the exact words they’re about, and resolve when they’re done.",
          "Turn downloads off for a link, or revoke it entirely. Sharing never confers ownership.",
        ]}
        visual={<ShareVisual />}
      />

      <Showcase
        id="control"
        eyebrow="New · Commits & review"
        title="Nothing lands in your document unless you say so."
        lede="Flip on Review Mode and every proposed change waits inside the page as a word-level diff — apply it or dismiss it. Commit a version whenever the document is somewhere worth returning to."
        items={[
          "Named commits with one-click restore, from the app or from Slack.",
          "Word-level insert / delete marks shown inline, not in a side-by-side wall.",
          "A full change history per document, each entry with a before and after snapshot.",
        ]}
        visual={<ControlVisual />}
      />

      {/* spec index */}
      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-24">
          <Eyebrow>Also included</Eyebrow>
          <h2 className="mt-5 max-w-xl text-[clamp(1.65rem,3.4vw,2.35rem)] font-bold leading-[1.15] tracking-[-0.02em]">
            The unglamorous parts, done properly.
          </h2>

          <dl className="mt-12">
            {SPECS.map((s) => (
              <div
                key={s.term}
                className="sd-reveal flex flex-col gap-1.5 border-t border-line py-5 sm:flex-row sm:gap-10 sm:py-6"
              >
                <dt className="w-40 shrink-0 text-[14.5px] font-bold tracking-tight">{s.term}</dt>
                <dd className="max-w-2xl text-[14.5px] leading-[1.7] text-ink-soft">{s.def}</dd>
              </div>
            ))}
            <div className="border-t border-line" />
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#211f1c] text-white">
        <div
          aria-hidden
          className="absolute -top-28 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(232,104,74,0.35),transparent)] blur-2xl"
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center md:px-8 md:py-28">
          <LogoMark size={52} />
          <h2 className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-bold leading-[1.12] tracking-[-0.02em]">
            Your next document is one sentence away.
          </h2>
          <p className="mt-4 max-w-md text-[15.5px] leading-[1.7] text-white/65">
            Bring the document you’ve been putting off — a contract, a résumé, a messy draft — and
            just say what you want changed.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-accent-deep"
            >
              Start free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 px-6 py-3 text-[15px] font-semibold text-white/90 transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-white/10 bg-[#211f1c]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-white/45 md:flex-row md:px-8">
          <span className="flex items-center gap-2">
            <FileText size={14} />© 2026 SuperDocs — AI document editing
          </span>
          <span className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="#slack" className="transition-colors hover:text-white">Slack</a>
            <a href="#gdocs" className="transition-colors hover:text-white">Google Docs</a>
            <a href="#sharing" className="transition-colors hover:text-white">Sharing</a>
            <Link href="/login" className="transition-colors hover:text-white">Sign in</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}

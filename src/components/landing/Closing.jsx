/**
 * Bottom of the landing page: the spec index of smaller features, the dark
 * closing call to action, and the footer that mirrors the nav's links.
 */

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Eyebrow } from "./Primitives";

/* Term / definition pairs for the spec index. */
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
    def: "Meeting notes, status update, one-pager, press release, statement of work, invoice, job offer and résumé — or ask the assistant to draft one.",
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

/**
 * "Also included" spec index: a definition list of the smaller features, one
 * reveal-animated row per SPECS entry.
 */
export function SpecIndex() {
  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-24">
        <Eyebrow>Also included</Eyebrow>
        <h2 className="mt-5 max-w-xl font-display text-[clamp(1.65rem,3.4vw,2.35rem)] font-bold leading-[1.15] tracking-[-0.02em]">
          The unglamorous parts, done properly.
        </h2>

        <dl className="mt-12">
          {SPECS.map((s) => (
            <div
              key={s.term}
              className="mp-reveal flex flex-col gap-1.5 border-t border-line py-5 sm:flex-row sm:gap-10 sm:py-6"
            >
              <dt className="w-40 shrink-0 text-[14.5px] font-bold tracking-tight">{s.term}</dt>
              <dd className="max-w-2xl text-[14.5px] leading-[1.7] text-ink-soft">{s.def}</dd>
            </div>
          ))}
          <div className="border-t border-line" />
        </dl>
      </div>
    </section>
  );
}

/** Dark closing call to action with the logo mark and both auth links. */
export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-[#202124] text-white">
      <div
        aria-hidden
        className="absolute -top-28 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(138,180,248,0.3),transparent)] blur-2xl"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center md:px-8 md:py-28">
        <LogoMark size={52} />
        <h2 className="mt-6 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-bold leading-[1.12] tracking-[-0.02em]">
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
  );
}

/** Dark footer: a copyright line plus the same anchor and sign-in links as the nav. */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#202124]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-white/45 md:flex-row md:px-8">
        <span className="flex items-center gap-2">
          <FileText size={14} />© 2026 MagicPen — AI document editing
        </span>
        <span className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a href="#usecases" className="transition-colors hover:text-white">Use cases</a>
          <a href="#slack" className="transition-colors hover:text-white">Slack</a>
          <a href="#gdocs" className="transition-colors hover:text-white">Google Docs</a>
          <a href="#sharing" className="transition-colors hover:text-white">Sharing</a>
          <Link href="/login" className="transition-colors hover:text-white">Sign in</Link>
        </span>
      </div>
    </footer>
  );
}

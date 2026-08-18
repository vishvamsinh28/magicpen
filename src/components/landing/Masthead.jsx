/**
 * Top of the landing page: the sticky site nav, the hero (copy beside the
 * HeroVisual mock), and the integrations strip. The nav's anchor hrefs must
 * match the section ids rendered by ShowcaseSections.
 */

import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";
import Logo, { LogoMark } from "@/components/Logo";
import { DocsMark, SlackMark } from "./BrandMarks";
import { Eyebrow } from "./Primitives";
import { HeroVisual } from "./ProductVisuals";

/** Sticky translucent nav: desktop anchor links plus sign-in and sign-up. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
        <Logo />
        <nav className="flex items-center gap-1 md:gap-2">
          {[
            ["Use cases", "#usecases"],
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
  );
}

/**
 * Hero section: the headline with its highlighter underline, supporting copy,
 * both calls to action, and the HeroVisual mock beside them.
 */
export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:px-8 md:pb-28 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="mp-pop-in">
        <Eyebrow>AI document editor</Eyebrow>
        <h1 className="mt-6 font-display text-[clamp(2.35rem,4.9vw,3.2rem)] font-bold leading-[1.08] tracking-[-0.03em]">
          Say what to change.{" "}
          {/* highlighter underline that survives a line break, unlike an
              absolutely-positioned bar */}
          <span className="[-webkit-box-decoration-break:clone] [box-decoration-break:clone] bg-[linear-gradient(to_top,#d3e3fd_0.36em,transparent_0.36em)]">
            Nothing else moves.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-[16.5px] leading-[1.7] text-ink-soft md:text-[17.5px]">
          MagicPen opens your document in a real editor and rewrites only the blocks you asked
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
            href="#usecases"
            className="rounded-lg border-[1.5px] border-line-strong bg-paper px-6 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-canvas"
          >
            See what it makes
          </a>
        </div>
        <p className="mt-5 text-[13px] text-muted">
          Free to use · no credit card · your documents stay private to your account
        </p>
      </div>

      <HeroVisual />
    </section>
  );
}

/** Slim band listing every surface MagicPen works in: web, Slack, Docs, links. */
export function IntegrationsStrip() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:gap-10 md:px-8">
        <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Works where the document already lives
        </p>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[14px] font-semibold text-ink">
          <span className="flex items-center gap-2">
            <LogoMark size={20} />
            MagicPen web
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
  );
}

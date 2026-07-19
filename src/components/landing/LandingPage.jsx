import Link from "next/link";
import {
  Sparkles, FileText, Download, ShieldCheck, LayoutTemplate, History,
  Upload, MessageSquare, Check, ArrowRight, FileUp, WandSparkles,
} from "lucide-react";
import Logo, { LogoMark } from "@/components/Logo";

const FEATURES = [
  {
    icon: WandSparkles,
    title: "AI editing, in place",
    text: "The assistant returns precise block-level edits — replace, insert, delete — never a full regeneration. Untouched content stays byte-for-byte identical.",
  },
  {
    icon: FileUp,
    title: "Bring any document",
    text: "PDF, DOCX, TXT, RTF, Markdown, or HTML up to 30 MB. Headings, tables, links, lists, and images come through intact.",
  },
  {
    icon: ShieldCheck,
    title: "Review Mode",
    text: "Flip the shield and every AI change waits for your approval. Apply it with one click or dismiss it — nothing lands without you.",
  },
  {
    icon: History,
    title: "Full change history",
    text: "Every edit is recorded with before-and-after snapshots. Roll the document back to any point, any time.",
  },
  {
    icon: LayoutTemplate,
    title: "Templates built in",
    text: "NDA, rent agreement, cover letter, meeting notes, proposal, invoice, resume — or just ask the chat to draft one from scratch.",
  },
  {
    icon: Download,
    title: "Leave with a real file",
    text: "Download as Word (.docx), Markdown, HTML, or plain text — or print straight to PDF. Formatting comes along for the ride.",
  },
];

const STEPS = [
  {
    icon: Upload,
    title: "Get a document in",
    text: "Upload a file, paste text, load a template, or ask the assistant to draft one.",
  },
  {
    icon: MessageSquare,
    title: "Say what you want changed",
    text: "“Make it more formal.” “Rewrite section two.” “Translate to Spanish.” Plain English is the interface.",
  },
  {
    icon: Download,
    title: "Download and go",
    text: "Export to Word and friends with your formatting preserved — no copy-paste laundering.",
  },
];

function HeroMockup() {
  return (
    <div className="mx-auto mt-14 w-full max-w-4xl rounded-xl border-[1.5px] border-frame bg-paper p-2 shadow-pop sd-pop-in">
      <div className="flex items-center gap-1.5 border-b border-line px-3 pb-2 pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-accent-faint" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-3 hidden rounded-md bg-ink px-2 py-0.5 text-[10px] font-medium text-white sm:block">
          1 · Offer Letter.docx
        </span>
      </div>
      <div className="grid gap-2 p-2 md:grid-cols-[240px_1fr]">
        {/* chat side */}
        <div className="flex flex-col justify-end gap-2 rounded-lg bg-cream p-3">
          <div className="ml-auto max-w-[92%] rounded-xl rounded-br-sm border border-accent-faint bg-accent-soft px-3 py-2 text-left text-[11.5px] text-ink">
            Make the intro more formal
          </div>
          <div className="max-w-[95%] rounded-xl border border-line bg-paper px-3 py-2 text-left text-[11.5px] leading-relaxed text-ink shadow-card">
            Done — I&apos;ve tightened up the opening paragraph.
            <span className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-line pt-1.5">
              <span className="rounded-full border border-line bg-cream px-1.5 py-0.5 text-[9.5px] text-ink-soft">✎ Edited block 1</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#e8f3ec] px-1.5 py-0.5 text-[9.5px] font-medium text-good">
                <Check size={9} strokeWidth={3} /> Applied
              </span>
            </span>
          </div>
        </div>
        {/* page side */}
        <div className="rounded-lg bg-parchment p-4">
          <div className="mx-auto max-w-sm rounded-[3px] bg-paper px-5 py-5 shadow-card ring-1 ring-line">
            <div className="h-3.5 w-2/3 rounded-sm bg-ink/85" />
            <div className="mt-3 space-y-1.5">
              <div className="h-2 w-full rounded-sm bg-accent-faint" />
              <div className="h-2 w-11/12 rounded-sm bg-accent-faint" />
              <div className="h-2 w-4/6 rounded-sm bg-accent-faint" />
            </div>
            <div className="mt-3.5 h-2.5 w-1/3 rounded-sm bg-ink/60" />
            <div className="mt-2 space-y-1.5">
              <div className="h-2 w-full rounded-sm bg-line" />
              <div className="h-2 w-10/12 rounded-sm bg-line" />
              <div className="h-2 w-11/12 rounded-sm bg-line" />
              <div className="h-2 w-3/5 rounded-sm bg-line" />
            </div>
            <div className="mt-3.5 h-2.5 w-2/5 rounded-sm bg-ink/60" />
            <div className="mt-2 space-y-1.5">
              <div className="h-2 w-full rounded-sm bg-line" />
              <div className="h-2 w-9/12 rounded-sm bg-line" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const primaryHref = "/register";
  const primaryLabel = "Get started free";

  return (
    <main className="min-h-dvh bg-cream text-ink">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
        <Logo />
        <nav className="flex items-center gap-1.5 md:gap-2">
          <a href="#features" className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink md:block">
            Features
          </a>
          <a href="#how" className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink md:block">
            How it works
          </a>
          <Link
            href="/login"
            className="rounded-lg border-[1.5px] border-frame bg-paper px-3.5 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-cream"
          >
            Sign in
          </Link>
          <Link
            href={primaryHref}
            className="rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 text-center md:px-8 md:pt-20">
        <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-[12px] font-semibold text-ink-soft shadow-card">
          <Sparkles size={13} className="text-accent" />
          AI document editor
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-[38px] font-bold leading-[1.1] tracking-tight md:text-[56px]">
          Edit documents with AI —{" "}
          <span className="relative inline-block">
            <span className="relative z-10">in place.</span>
            <span aria-hidden className="absolute inset-x-0 bottom-1 z-0 h-3.5 rounded-sm bg-accent-faint md:h-5" />
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-soft md:text-[18px]">
          Stop pasting into a chatbot and reassembling the pieces. Upload a PDF or Word file,
          ask in plain English, and SuperDocs edits only what you asked for — your formatting,
          tables, and footnotes survive.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryHref}
            className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep"
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </Link>
          <a
            href="#features"
            className="rounded-lg border-[1.5px] border-frame bg-paper px-6 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-cream"
          >
            See what it does
          </a>
        </div>
        <p className="mt-4 text-[12.5px] text-muted">
          Free to use · your documents stay private to your account
        </p>

        <HeroMockup />
      </section>

      {/* features */}
      <section id="features" className="border-t border-line bg-paper py-20">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <h2 className="text-center text-[28px] font-bold tracking-tight md:text-[36px]">
            Built for documents, not chat transcripts
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-ink-soft">
            Everything happens in a real editor with your file loaded — the AI is a collaborator
            with a very steady hand.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-cream p-6 transition-shadow hover:shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-accent-deep">
                  <f.icon size={21} strokeWidth={1.9} />
                </span>
                <h3 className="mt-4 text-[16.5px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <h2 className="text-center text-[28px] font-bold tracking-tight md:text-[36px]">
            Three steps, no copy-paste
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-xl border-[1.5px] border-frame bg-paper p-6 shadow-card">
                <span className="absolute -top-3.5 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-deep">
                  <s.icon size={19} strokeWidth={1.9} />
                </span>
                <h3 className="mt-3.5 text-[15.5px] font-bold">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center rounded-2xl border-[1.5px] border-frame bg-paper px-6 py-14 text-center shadow-card">
          <LogoMark size={56} />
          <h2 className="mt-5 text-[26px] font-bold tracking-tight md:text-[32px]">
            Your next document, done in minutes
          </h2>
          <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
            Upload something you&apos;ve been putting off — a resume, a contract, a messy draft —
            and just say what you want changed.
          </p>
          <Link
            href={primaryHref}
            className="mt-6 flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep"
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-muted md:flex-row md:px-8">
          <span className="flex items-center gap-2">
            <FileText size={15} />
            © 2026 SuperDocs — AI document editing
          </span>
          <span className="flex items-center gap-5">
            <a href="#features" className="transition-colors hover:text-ink">Features</a>
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <Link href="/login" className="transition-colors hover:text-ink">
              Sign in
            </Link>
          </span>
        </div>
      </footer>
    </main>
  );
}

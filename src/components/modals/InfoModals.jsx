"use client";

import {
  Sparkles, Check, UserRound, Bug, BookOpen, CircleHelp, Settings as SettingsIcon, LogOut,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Modal from "@/components/ui/Modal";
import { LogoMark } from "@/components/Logo";

function Section({ title, children }) {
  return (
    <div className="mt-4">
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      <div className="mt-1 text-[13px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            value === opt.value
              ? "border-accent bg-accent-soft text-accent-deep"
              : "border-line bg-paper text-ink-soft hover:bg-cream"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingsBody() {
  const ws = useWorkspace();
  const { settings, setSettings } = ws;
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <SettingsIcon size={18} /> Settings
      </h2>
      <Section title="AI model">
        <p className="text-[12.5px]">
          SuperDocs runs on <strong>Gemini 3.5 Flash</strong> (<code className="rounded bg-cream px-1 py-0.5 text-[11.5px]">gemini-3.5-flash</code>).
        </p>
      </Section>
      <Section title="Editing style">
        <ChipGroup
          value={settings.mode}
          onChange={(mode) => setSettings((s) => ({ ...s, mode }))}
          options={[
            { value: "precise", label: "Precise" },
            { value: "balanced", label: "Balanced" },
            { value: "creative", label: "Creative" },
          ]}
        />
      </Section>
      <Section title="Applying changes">
        <ChipGroup
          value={settings.autoApply ? "auto" : "review"}
          onChange={(v) => setSettings((s) => ({ ...s, autoApply: v === "auto" }))}
          options={[
            { value: "auto", label: "Auto-apply edits" },
            { value: "review", label: "Review before applying" },
          ]}
        />
        <p className="mt-2 text-[12px] text-muted">
          In Review Mode the assistant proposes changes and you approve or dismiss them in the chat.
        </p>
      </Section>
      <Section title="Connections">
        <p className="text-[12.5px]">
          AI, database and storage are configured through <code className="rounded bg-cream px-1 py-0.5 text-[11.5px]">.env.local</code> —
          see <code className="rounded bg-cream px-1 py-0.5 text-[11.5px]">.env.example</code> in the project root
          (Gemini API key, MongoDB URI, AUTH_SECRET, Supabase storage keys).
        </p>
      </Section>
    </>
  );
}

function UpgradeBody() {
  const plans = [
    { name: "Free", price: "$0", features: ["Unlimited local documents", "Core AI model", "Templates & change history"], current: true },
    { name: "Pro", price: "$12/mo", features: ["Pro AI model", "Larger documents", "Priority processing", "Version history forever"] },
    { name: "Team", price: "$29/mo", features: ["Everything in Pro", "Shared workspaces", "Admin controls", "SSO"] },
  ];
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <Sparkles size={18} className="text-accent" /> Upgrade SuperDocs
      </h2>
      <p className="mt-1 text-[13px] text-muted">Billing isn&apos;t wired up in this build — consider this a preview.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className={`rounded-xl border p-3.5 ${plan.current ? "border-line bg-cream" : "border-accent bg-paper shadow-card"}`}>
            <p className="text-[14px] font-bold text-ink">{plan.name}</p>
            <p className="mt-0.5 text-[13px] font-semibold text-accent-deep">{plan.price}</p>
            <ul className="mt-2.5 space-y-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-soft">
                  <Check size={12} className="mt-0.5 shrink-0 text-good" /> {f}
                </li>
              ))}
            </ul>
            <button
              disabled={plan.current}
              onClick={() => {}}
              className={`mt-3 w-full rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${
                plan.current
                  ? "cursor-default border border-line text-muted"
                  : "bg-accent text-white transition-colors hover:bg-accent-deep"
              }`}
            >
              {plan.current ? "Current plan" : "Coming soon"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function GetStartedBody() {
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <CircleHelp size={18} /> Get started
      </h2>
      <Section title="1 · Get a document in">
        Upload a PDF, DOCX, TXT, RTF, Markdown or HTML file — or just paste/type into the
        editor. You can also ask the assistant to <em>&quot;create a rent agreement&quot;</em> or load a template.
      </Section>
      <Section title="2 · Tell the assistant what to change">
        &quot;Make this more formal&quot;, &quot;rewrite the second section&quot;, &quot;translate to Spanish&quot;,
        &quot;highlight the key dates&quot; — it edits only the relevant parts, in place, keeping your formatting.
      </Section>
      <Section title="3 · Stay in control">
        Toggle the shield icon under the chat to switch to Review Mode and approve every change.
        The Changes tab keeps a full history you can roll back to.
      </Section>
      <Section title="4 · Get it out">
        Download as Word, Markdown, HTML or plain text — or print to PDF. Formatting comes along.
      </Section>
    </>
  );
}

function DocsBody() {
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <BookOpen size={18} /> Docs
      </h2>
      <Section title="Editing">
        The toolbar covers size, spacing, bold/italic/underline/strikethrough, text color and
        highlights. The ⋯ menu has headings, lists, quotes, code, tables, links and alignment.
      </Section>
      <Section title="AI edits">
        The assistant sees your document as numbered blocks and returns minimal edit
        operations — replace, insert, delete — so untouched content is preserved exactly.
      </Section>
      <Section title="AI model">
        Everything runs on <strong>Gemini 3.5 Flash</strong>. If the model ID ever changes, point{" "}
        <code className="rounded bg-cream px-1 py-0.5 text-[11.5px]">GEMINI_MODEL</code> in{" "}
        <code className="rounded bg-cream px-1 py-0.5 text-[11.5px]">.env.local</code> at the new one.
      </Section>
      <Section title="Attachments">
        Use 📎 in the chat to attach reference files. Their text is given to the assistant as
        context — handy for &quot;rewrite my resume to match this job posting&quot;.
      </Section>
      <Section title="Keyboard">
        Enter sends a chat message (Shift+Enter for a new line). In the editor, the usual
        shortcuts work: ⌘B, ⌘I, ⌘U, ⌘Z / ⌘⇧Z.
      </Section>
    </>
  );
}

function BugBody() {
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <Bug size={18} /> Report a bug
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        Found something broken? Tell us what happened and what you expected — screenshots help a lot.
      </p>
      <a
        href="mailto:support@superdocs.app?subject=SuperDocs%20bug%20report&body=What%20happened%3A%0A%0AWhat%20I%20expected%3A%0A%0ASteps%20to%20reproduce%3A%0A"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-deep"
      >
        Email support@superdocs.app
      </a>
      <p className="mt-3 text-[12px] text-muted">
        Server-side errors are also logged to the terminal running <code className="rounded bg-cream px-1 py-0.5 text-[11px]">npm run dev</code>.
      </p>
    </>
  );
}

function ProfileBody() {
  const ws = useWorkspace();
  const { user } = ws;
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <UserRound size={18} /> Profile
      </h2>
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-cream p-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-paper shadow-card">
          <LogoMark size={36} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">{user?.name || user?.email}</p>
          <p className="truncate text-[12.5px] text-muted">{user?.email}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            Your documents and chats are private to this account.
          </p>
        </div>
      </div>
      <button
        onClick={ws.signOut}
        className="mt-4 flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-cream"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </>
  );
}

const BODIES = {
  settings: SettingsBody,
  upgrade: UpgradeBody,
  getstarted: GetStartedBody,
  docs: DocsBody,
  bug: BugBody,
  profile: ProfileBody,
};

export default function InfoModals() {
  const ws = useWorkspace();
  const Body = ws.infoModal ? BODIES[ws.infoModal] : null;
  return (
    <Modal open={!!Body} onClose={() => ws.setInfoModal(null)}>
      <div className="p-5 pt-6">{Body && <Body />}</div>
    </Modal>
  );
}

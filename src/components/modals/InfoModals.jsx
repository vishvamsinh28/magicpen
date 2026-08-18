"use client";

import { UserRound, Settings as SettingsIcon, LogOut } from "lucide-react";
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
              : "border-line bg-paper text-ink-soft hover:bg-canvas"
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
          MagicPen runs on <strong>Gemini 3.1 Flash-Lite</strong> (<code className="rounded bg-canvas px-1 py-0.5 text-[11.5px]">gemini-3.1-flash-lite</code>).
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
          AI, database and storage are configured through <code className="rounded bg-canvas px-1 py-0.5 text-[11.5px]">.env.local</code> —
          see <code className="rounded bg-canvas px-1 py-0.5 text-[11.5px]">.env.example</code> in the project root
          (Gemini API key, MongoDB URI, AUTH_SECRET, Supabase storage keys).
        </p>
      </Section>
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
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-canvas p-4">
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
        className="mt-4 flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-canvas"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </>
  );
}

const BODIES = {
  settings: SettingsBody,
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

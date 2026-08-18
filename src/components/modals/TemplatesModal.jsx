"use client";

import {
  NotebookPen, Activity, Package, Megaphone, Handshake, Receipt, Briefcase, UserRound, FileText,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import Modal from "@/components/ui/Modal";
import { TEMPLATES } from "@/lib/templates";

// Maps each template's `icon` key (from lib/templates) to its lucide glyph;
// unknown keys fall back to FileText at render time.
const ICONS = {
  notebook: NotebookPen,
  activity: Activity,
  package: Package,
  megaphone: Megaphone,
  handshake: Handshake,
  receipt: Receipt,
  briefcase: Briefcase,
  user: UserRound,
};

/**
 * Full-screen template gallery: one card per entry in lib/templates. Picking
 * a card hands the whole template object to the workspace context, which
 * creates a pre-filled document from it (and handles its own errors).
 */
export default function TemplatesModal() {
  const ws = useWorkspace();

  return (
    <Modal open={ws.templatesOpen} onClose={() => ws.setTemplatesOpen(false)} variant="full" labelledBy="templates-title">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-12 md:py-10">
        <h1 id="templates-title" className="text-[26px] font-bold tracking-tight text-ink md:text-[30px]">
          Templates
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Start from a ready-made document and let the assistant fill in the details — try
          &quot;fill this invoice for two weeks of design work for Acme Studio&quot;.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 md:grid-cols-3">
          {TEMPLATES.map((template) => {
            const Icon = ICONS[template.icon] || FileText;
            return (
              <button
                key={template.id}
                onClick={() => ws.createDocumentFromTemplate(template)}
                className="flex flex-col items-start rounded-[4px] border border-line bg-paper p-5 text-left shadow-card transition-shadow hover:shadow-pop"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-accent-deep">
                  <Icon size={21} strokeWidth={1.9} />
                </span>
                <span className="mt-4 text-[15.5px] font-semibold text-ink">{template.name}</span>
                <span className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {template.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { Check, Pencil, Paintbrush, FilePlus2, FileMinus2, FileText } from "lucide-react";

// Renders the diff items produced by buildDiffItems (src/lib/diff.js). Used by
// the review card in chat (selectable) and the Changes panel (read-only).

const KIND_ICONS = {
  text: <Pencil size={11} />,
  formatting: <Paintbrush size={11} />,
  add: <FilePlus2 size={11} />,
  remove: <FileMinus2 size={11} />,
  rewrite: <FileText size={11} />,
  new: <FileText size={11} />,
};

export function DiffText({ parts }) {
  return (
    <p className="text-[12.5px] leading-relaxed text-ink">
      {parts.map((part, i) => {
        const space = i > 0 ? " " : "";
        if (part.type === "del") {
          return (
            <span key={i}>
              {space}
              <del className="rounded-[3px] bg-red-50 px-0.5 text-red-700 decoration-red-400">{part.text}</del>
            </span>
          );
        }
        if (part.type === "ins") {
          return (
            <span key={i}>
              {space}
              <ins className="rounded-[3px] bg-[#e3f1e8] px-0.5 text-good no-underline">{part.text}</ins>
            </span>
          );
        }
        return <span key={i}>{space + part.text}</span>;
      })}
    </p>
  );
}

// The html here is already sanitized server-side (cleanDocHtml) — it's the
// exact markup that lands in the editor if the change is applied.
function HtmlPreview({ html, tone }) {
  const toneClass =
    tone === "add"
      ? "border-[#cbe4d5] bg-[#f2faf5]"
      : tone === "remove"
        ? "border-red-100 bg-red-50/60 line-through decoration-red-300 opacity-80"
        : "border-line bg-cream";
  return (
    <div
      className={`diff-preview rounded-lg border px-2.5 py-1.5 ${toneClass}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function DiffBody({ item }) {
  switch (item.kind) {
    case "text":
    case "rewrite":
      return <DiffText parts={item.parts} />;
    case "formatting":
      return (
        <div className="space-y-1.5">
          <p className="text-[11.5px] italic text-muted">{item.note}</p>
          <HtmlPreview html={item.html} />
        </div>
      );
    case "add":
    case "new":
      return <HtmlPreview html={item.html} tone="add" />;
    case "remove":
      return <HtmlPreview html={item.html} tone="remove" />;
    default:
      return null;
  }
}

export function DiffItem({ item, selectable = false, checked = true, onToggle }) {
  return (
    <div
      className={`rounded-lg border p-2 transition-opacity ${
        selectable && !checked ? "border-line bg-cream opacity-50" : "border-line bg-paper"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {selectable && (
          <button
            onClick={onToggle}
            aria-label={checked ? `Skip: ${item.label}` : `Include: ${item.label}`}
            aria-pressed={checked}
            className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors ${
              checked ? "border-accent bg-accent text-white" : "border-frame bg-paper text-transparent hover:text-muted"
            }`}
          >
            <Check size={11} strokeWidth={3.5} />
          </button>
        )}
        <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-ink-soft">
          {KIND_ICONS[item.kind]}
          <span className="truncate">{item.label}</span>
        </span>
        {item.sub && <span className="min-w-0 truncate text-[11px] text-muted">{item.sub}</span>}
      </div>
      <div className="mt-1.5 max-h-44 overflow-y-auto">
        <DiffBody item={item} />
      </div>
    </div>
  );
}

export default function DiffList({ items, selectable = false, deselected, onToggle }) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <DiffItem
          key={i}
          item={item}
          selectable={selectable}
          checked={!deselected?.has(i)}
          onToggle={() => onToggle?.(i)}
        />
      ))}
    </div>
  );
}

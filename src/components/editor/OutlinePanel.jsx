"use client";

import { useMemo } from "react";

/**
 * Heading outline (levels 1-3) — click an entry to jump to that heading.
 * Derived from the live doc; `tick` bumps on every edit so the list stays
 * fresh without subscribing to the editor directly.
 */
export default function OutlinePanel({ editor, tick, onNavigate }) {
  const items = useMemo(() => {
    if (!editor) return [];
    const found = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading" && node.attrs.level <= 3 && node.textContent.trim()) {
        found.push({ level: node.attrs.level, text: node.textContent.trim(), pos });
      }
    });
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, tick]);

  return (
    <div className="absolute left-3 top-12 z-20 flex max-h-[65%] w-60 flex-col rounded-xl border border-line bg-paper shadow-pop">
      <p className="shrink-0 border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Outline
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length === 0 && (
          <p className="px-2 py-1.5 text-[12px] leading-relaxed text-muted">
            Add headings and they'll show up here.
          </p>
        )}
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onNavigate(item)}
            className={`block w-full truncate rounded-md py-1 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-canvas hover:text-ink ${
              item.level === 1 ? "pl-2 font-semibold text-ink" : item.level === 2 ? "pl-4" : "pl-6"
            } pr-2`}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}

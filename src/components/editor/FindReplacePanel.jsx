"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, CaseSensitive, X } from "lucide-react";
import { findMatches, searchPluginKey } from "./search";

/**
 * Compact find & replace card (Ctrl/Cmd+F). Owns the query state, feeds match
 * decorations to the SearchHighlight plugin, and replaces via transactions so
 * marks on surrounding text survive. `focusNonce` re-focuses the find input.
 */
export default function FindReplacePanel({ editor, focusNonce, onClose }) {
  const [query, setQuery] = useState(() => {
    // Prefill from the current selection, like Google Docs.
    const { from, to, empty } = editor.state.selection;
    if (empty) return "";
    const text = editor.state.doc.textBetween(from, to, " ").trim();
    return text.length && text.length <= 80 ? text : "";
  });
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [active, setActive] = useState(-1);
  const [matchCount, setMatchCount] = useState(0);
  const matchesRef = useRef([]);
  const paramsRef = useRef({ query: "", caseSensitive: false, active: -1 });
  // Marks our own dispatches so the doc-update listener doesn't re-enter.
  const suppressRef = useRef(false);
  const inputRef = useRef(null);

  // Dispatch with the suppress flag up; finally keeps the flag from sticking.
  const quietDispatch = (tr) => {
    suppressRef.current = true;
    try {
      editor.view.dispatch(tr);
    } finally {
      suppressRef.current = false;
    }
  };

  const scrollToMatch = (match) => {
    if (!match) return;
    const dom = editor.view.domAtPos(match.from);
    const el = dom.node.nodeType === 1 ? dom.node : dom.node.parentElement;
    el?.scrollIntoView({ block: "center" });
  };

  // Recompute matches + decorations. activeIndex wraps in both directions.
  const applySearch = (q, cs, nextActive, scroll) => {
    const matches = findMatches(editor.state.doc, q, cs);
    const idx = matches.length ? ((nextActive % matches.length) + matches.length) % matches.length : -1;
    matchesRef.current = matches;
    paramsRef.current = { query: q, caseSensitive: cs, active: idx };
    quietDispatch(editor.state.tr.setMeta(searchPluginKey, { matches, activeIndex: idx }));
    setMatchCount(matches.length);
    setActive(idx);
    if (scroll && idx >= 0) scrollToMatch(matches[idx]);
  };

  useEffect(() => {
    applySearch(query, caseSensitive, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive]);

  // Doc edited while the panel is open (typing, AI, replace) — recompute.
  useEffect(() => {
    const onUpdate = () => {
      if (suppressRef.current) return;
      const p = paramsRef.current;
      applySearch(p.query, p.caseSensitive, Math.max(p.active, 0), false);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      // Leaving the panel clears the highlights (unless the editor instance
      // is already torn down, e.g. when collaboration swaps it out).
      if (!editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, { matches: [], activeIndex: -1 }));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusNonce]);

  const step = (dir) => applySearch(query, caseSensitive, (active < 0 ? 0 : active + dir), true);

  const replaceOne = () => {
    const match = matchesRef.current[active];
    if (!match) return;
    quietDispatch(editor.state.tr.insertText(replaceText, match.from, match.to));
    // Land on the next match after the replacement (don't re-match inside it).
    const afterPos = match.from + replaceText.length;
    const fresh = findMatches(editor.state.doc, query, caseSensitive);
    const nextIdx = Math.max(0, fresh.findIndex((m) => m.from >= afterPos));
    applySearch(query, caseSensitive, fresh.length ? nextIdx : 0, true);
  };

  const replaceAll = () => {
    const matches = matchesRef.current;
    if (!matches.length) return;
    let tr = editor.state.tr;
    for (let i = matches.length - 1; i >= 0; i--) {
      tr = tr.insertText(replaceText, matches[i].from, matches[i].to);
    }
    quietDispatch(tr);
    applySearch(query, caseSensitive, 0, false);
  };

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const onFindKeys = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="absolute right-3 top-3 z-30 w-[340px] max-w-[calc(100%-24px)] rounded-xl border border-line bg-paper p-2 shadow-pop">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFindKeys}
          placeholder="Find in document"
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <span className="w-12 shrink-0 text-center text-[11.5px] tabular-nums text-muted">
          {query ? (matchCount ? `${active + 1}/${matchCount}` : "0") : ""}
        </span>
        <button
          onClick={() => setCaseSensitive((v) => !v)}
          title="Match case"
          aria-pressed={caseSensitive}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            caseSensitive ? "bg-accent-soft text-accent-deep" : "text-ink-soft hover:bg-canvas"
          }`}
        >
          <CaseSensitive size={15} />
        </button>
        <button onClick={() => step(-1)} disabled={!matchCount} title="Previous match (Shift+Enter)" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35">
          <ArrowUp size={14} />
        </button>
        <button onClick={() => step(1)} disabled={!matchCount} title="Next match (Enter)" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35">
          <ArrowDown size={14} />
        </button>
        <button onClick={close} aria-label="Close find and replace" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas">
          <X size={14} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <input
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              replaceOne();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
          placeholder="Replace with"
          className="h-8 min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          onClick={replaceOne}
          disabled={!matchCount}
          className="h-8 shrink-0 rounded-md border border-line px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35"
        >
          Replace
        </button>
        <button
          onClick={replaceAll}
          disabled={!matchCount}
          className="h-8 shrink-0 rounded-md border border-line px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-canvas disabled:opacity-35"
        >
          All
        </button>
      </div>
    </div>
  );
}

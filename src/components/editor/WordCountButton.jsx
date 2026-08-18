"use client";

/**
 * Word/character counter pinned to the bottom-left of the page. Counts the
 * selection when one exists, the whole document otherwise; clicking cycles
 * words → chars → chars-without-spaces. `countMode` state lives in the parent
 * so the chosen mode survives this button unmounting during previews.
 */

const wordsIn = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

// Label for the current mode; recomputed every render, which the parent
// triggers on each edit/selection change via its tick state.
function countLabel(editor, countMode) {
  if (!editor) return "";
  const doc = editor.state.doc;
  const docText = doc.textBetween(0, doc.content.size, " ");
  const { from, to, empty } = editor.state.selection;
  const selText = empty ? null : doc.textBetween(from, to, " ");
  if (countMode === "chars") {
    const total = docText.replace(/\s+/g, " ").trim().length;
    return selText
      ? `${selText.length.toLocaleString()} of ${total.toLocaleString()} characters`
      : `${total.toLocaleString()} characters`;
  }
  if (countMode === "charsNoSpaces") {
    const strip = (t) => t.replace(/\s/g, "").length;
    return selText
      ? `${strip(selText).toLocaleString()} of ${strip(docText).toLocaleString()} characters (no spaces)`
      : `${strip(docText).toLocaleString()} characters (no spaces)`;
  }
  return selText
    ? `${wordsIn(selText).toLocaleString()} of ${wordsIn(docText).toLocaleString()} words`
    : `${wordsIn(docText).toLocaleString()} words`;
}

export default function WordCountButton({ editor, countMode, onCycle }) {
  return (
    <button
      onClick={onCycle}
      title="Click to switch between words and characters"
      className="absolute bottom-4 left-4 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink-soft shadow-card transition-colors hover:bg-canvas"
    >
      {countLabel(editor, countMode)}
    </button>
  );
}

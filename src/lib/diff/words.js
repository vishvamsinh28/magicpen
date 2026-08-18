"use client";

/**
 * Word-level LCS diff over plain text, plus small word utilities shared by
 * the diff item builders. Pure string work — safe anywhere, kept under the
 * client entry because that's the only consumer.
 */

/** Whitespace-split tokens of a text; [] for empty input. */
export const tokenize = (text) => (text ? text.split(/\s+/).filter(Boolean) : []);

// Past this table size the LCS isn't worth computing — treat it as a rewrite.
const MAX_LCS_CELLS = 250_000;

/**
 * Word-level diff of two texts → [{ type: 'same'|'del'|'ins', text }], with
 * adjacent runs of the same type merged. Falls back to whole-text del+ins
 * when the changed middle is too large for the LCS table.
 */
export function diffWords(beforeText, afterText) {
  const a = tokenize(beforeText);
  const b = tokenize(afterText);

  const parts = [];
  const push = (type, tokens) => {
    if (!tokens.length) return;
    const text = tokens.join(" ");
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += ` ${text}`;
    else parts.push({ type, text });
  };

  // Trim the common prefix/suffix so the LCS table only covers the changed middle.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  push("same", a.slice(0, start));

  if (!midA.length || !midB.length || midA.length * midB.length > MAX_LCS_CELLS) {
    push("del", midA);
    push("ins", midB);
  } else {
    // Flat Uint32Array LCS table, walked greedily from the top-left.
    const cols = midB.length + 1;
    const lcs = new Uint32Array((midA.length + 1) * cols);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        lcs[i * cols + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * cols + j + 1] + 1
            : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    let delRun = [];
    let insRun = [];
    const flush = () => {
      push("del", delRun);
      push("ins", insRun);
      delRun = [];
      insRun = [];
    };
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        flush();
        push("same", [midA[i]]);
        i++;
        j++;
      } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
        delRun.push(midA[i++]);
      } else {
        insRun.push(midB[j++]);
      }
    }
    delRun.push(...midA.slice(i));
    insRun.push(...midB.slice(j));
    flush();
  }

  push("same", a.slice(endA));
  return parts;
}

/** First `words` words of a text, with an ellipsis when truncated. */
export const snippet = (text, words = 7) => {
  const t = tokenize(text);
  return t.length > words ? `${t.slice(0, words).join(" ")}…` : t.join(" ");
};

"use client";

/**
 * Structure-preserving HTML diff for the in-document review preview.
 * Tokenizes markup into tags / words / whitespace, aligns the two token
 * streams (LCS), and wraps changed words in <ins>/<del> while tags pass
 * through — so a reworded table cell still renders inside its cell, and a
 * restyled block keeps the proposed styling without duplicating structure.
 */

const TOKEN_RE = /<[^>]+>|[^<\s]+|\s+/g;

const isTag = (t) => t.charCodeAt(0) === 60; /* '<' */
const isClose = (t) => isTag(t) && t[1] === "/";
const isWs = (t) => !t.trim();
const tagName = (t) => (t.match(/^<\/?\s*([a-zA-Z0-9-]+)/) || [])[1]?.toLowerCase() || "";

// Loose equality: tags match by name (attribute-only changes must not
// duplicate structure), any whitespace matches any whitespace. Wherever the
// two sides "match", the NEW token is emitted, so proposed style changes show.
function eq(a, b) {
  if (a === b) return true;
  if (isTag(a) && isTag(b)) return isClose(a) === isClose(b) && tagName(a) === tagName(b);
  if (isWs(a) && isWs(b)) return true;
  return false;
}

// Wrap the text of a changed run in <ins>/<del>; tags stream through
// unwrapped (except <img>, which is markable content itself).
function wrapRun(tokens, tag) {
  if (!tokens.length) return "";
  let out = "";
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join("");
    out += text.trim() ? `<${tag}>${text}</${tag}>` : text;
    buf = [];
  };
  for (const t of tokens) {
    if (isTag(t) && tagName(t) !== "img") {
      flush();
      out += t;
    } else {
      buf.push(t);
    }
  }
  flush();
  return out;
}

// Past this table size the LCS isn't worth it — render as full old/new swap.
const MAX_LCS_CELLS = 400_000;

/**
 * Diff two HTML strings into one HTML string with changed words wrapped in
 * <ins>/<del>. Where the two sides "match" loosely, the NEW token is emitted,
 * so attribute/style changes take effect without being marked as edits.
 */
export function diffHtml(oldHtml, newHtml) {
  const a = (oldHtml || "").match(TOKEN_RE) || [];
  const b = (newHtml || "").match(TOKEN_RE) || [];

  let out = "";
  let delBuf = [];
  let insBuf = [];
  const flushChanged = () => {
    out += wrapRun(delBuf, "del") + wrapRun(insBuf, "ins");
    delBuf = [];
    insBuf = [];
  };

  // Trim the loosely-equal prefix/suffix so the LCS only covers the middle.
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start], b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1], b[endB - 1])) {
    endA--;
    endB--;
  }

  out += b.slice(0, start).join("");

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  if (midA.length * midB.length > MAX_LCS_CELLS) {
    delBuf = midA;
    insBuf = midB;
    flushChanged();
  } else if (midA.length || midB.length) {
    const cols = midB.length + 1;
    const lcs = new Uint32Array((midA.length + 1) * cols);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        lcs[i * cols + j] = eq(midA[i], midB[j])
          ? lcs[(i + 1) * cols + j + 1] + 1
          : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (eq(midA[i], midB[j])) {
        flushChanged();
        out += midB[j];
        i++;
        j++;
      } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
        delBuf.push(midA[i++]);
      } else {
        insBuf.push(midB[j++]);
      }
    }
    delBuf.push(...midA.slice(i));
    insBuf.push(...midB.slice(j));
    flushChanged();
  }

  out += b.slice(endB).join("");
  return out;
}

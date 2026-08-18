/**
 * Post-conversion HTML annotation helpers shared by the DOCX and PDF parsers:
 * wrap plain-text occurrences of a string in formatting tags without ever
 * touching regions that are already links, marks, or styled runs.
 */

// Regions that must never be re-wrapped: existing links, marks, u/s runs, and
// float/color spans (resume tails, re-applied DOCX run styles).
const PROTECTED_SEGMENTS =
  /(<a [\s\S]*?<\/a>|<mark[\s\S]*?<\/mark>|<u>[\s\S]*?<\/u>|<s>[\s\S]*?<\/s>|<span[^>]*style="[^"]*(?:float|color)[^"]*"[^>]*>[\s\S]*?<\/span>)/gi;

/**
 * Wrap the first plain-text occurrence of `text` with open/close tags,
 * skipping protected segments and matches that land inside a tag. Returns the
 * wrapped html, or null when the text wasn't found in plain form.
 */
export function wrapPlainText(html, text, open, close) {
  const isInsideTag = (segment, index) =>
    segment.lastIndexOf("<", index) > segment.lastIndexOf(">", index);

  // split() with a capturing group alternates plain segments (even indices)
  // with protected ones (odd indices) — only even segments are searched.
  const segments = html.split(PROTECTED_SEGMENTS);
  for (let i = 0; i < segments.length; i += 2) {
    const idx = segments[i].indexOf(text);
    if (idx === -1 || isInsideTag(segments[i], idx)) continue;
    segments[i] =
      segments[i].slice(0, idx) + open + text + close + segments[i].slice(idx + text.length);
    return segments.join("");
  }
  return null;
}

/**
 * wrapPlainText with retries: the exact annotation text may cross tags the
 * model added ("<strong>WORD</strong> next"), so edge words are dropped one at
 * a time before giving up. Returns the html unchanged when nothing matched.
 */
export function wrapWithFallbacks(html, text, open, close) {
  const words = text.split(" ");
  const candidates = [text];
  if (words.length > 1) {
    candidates.push(words.slice(0, -1).join(" "), words.slice(1).join(" "));
    if (words.length > 2) candidates.push(words.slice(1, -1).join(" "));
  }
  for (const candidate of candidates) {
    if (candidate.length < 3) continue;
    const wrapped = wrapPlainText(html, candidate, open, close);
    if (wrapped) return wrapped;
  }
  return html;
}

/**
 * Wrap any anchor text whose URL the model failed to attach, so every
 * hyperlink found in the PDF's annotations survives into the editor HTML.
 */
export function ensureLinks(html, anchors) {
  for (const { url, text } of anchors) {
    if (!text || html.includes(`href="${url}"`)) continue;
    const safeUrl = url.replace(/"/g, "%22");
    html = wrapWithFallbacks(
      html,
      text,
      `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">`,
      "</a>"
    );
  }
  return html;
}

/**
 * Apply Highlight/Underline/StrikeOut annotations the model didn't reproduce,
 * as <mark>/<u>/<s> around the annotated text.
 */
export function ensureMarkup(html, markups) {
  for (const { kind, text, color } of markups) {
    const open =
      kind === "mark" ? `<mark style="background-color:${color}">` : `<${kind}>`;
    const close = kind === "mark" ? "</mark>" : `</${kind}>`;
    html = wrapWithFallbacks(html, text, open, close);
  }
  return html;
}

import sanitizeHtml from "sanitize-html";

/**
 * HTML sanitization for the whole app. Every piece of HTML that enters the
 * system (uploads, AI output, exports) passes through here so the editor and
 * stored docs stay script-free. The allowlists below define exactly what the
 * editor can represent — widen them only together with the editor schema.
 */

const STYLE_PROPS = {
  color: [/^.*$/],
  "background-color": [/^.*$/],
  "font-size": [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
  "line-height": [/^\d+(\.\d+)?$/],
  "text-align": [/^(left|right|center|justify)$/],
  "font-family": [/^[\w\s,'"-]+$/],
  // The editor's Bold/Italic/Underline/Strike marks parse these style forms
  // (the AI often styles whole blocks instead of using tags).
  "font-weight": [/^(normal|bold|bolder|[1-9]00)$/],
  "font-style": [/^(normal|italic)$/],
  "text-decoration": [/^(none|underline|line-through|underline line-through|line-through underline)$/],
  "text-decoration-line": [/^(none|underline|line-through|underline line-through|line-through underline)$/],
  // right-aligned tail on the same line (resume-style "company ↔ location" rows)
  float: [/^right$/],
  // manual page breaks — honored by the print/PDF path
  "page-break-after": [/^always$/],
  "break-after": [/^page$/],
};

/**
 * Names of the CSS properties sanitization keeps. Exported so the AI layer
 * can detect (and retry) styles that would be stripped.
 */
export const ALLOWED_STYLE_PROP_NAMES = Object.keys(STYLE_PROPS);

const OPTIONS = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "div",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "strong", "b", "em", "i", "u", "s", "strike", "del", "span", "mark", "sub", "sup",
    "a", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
    "figure", "figcaption",
    // checklists (TipTap task lists): <ul data-type="taskList"><li data-checked><label><input …
    "label", "input",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel", "style"],
    img: ["src", "alt", "width", "height", "style"],
    th: ["colspan", "rowspan", "style"],
    td: ["colspan", "rowspan", "style"],
    ol: ["start", "type", "style"],
    ul: ["data-type", "style"],
    li: ["data-type", "data-checked", "style"],
    input: [{ name: "type", values: ["checkbox"] }, "checked", "disabled"],
  },
  allowedStyles: { "*": STYLE_PROPS },
  allowedSchemes: ["http", "https", "mailto", "data"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

/**
 * Sanitize document HTML against the editor's allowlist. Strips scripts,
 * event handlers, unknown tags/attributes, and disallowed inline styles;
 * returns "" for empty input.
 */
export function cleanDocHtml(html) {
  if (!html) return "";
  return sanitizeHtml(String(html), OPTIONS).trim();
}

/**
 * HTML → readable plain text: block boundaries become newlines, entities are
 * decoded, runs of blank lines collapse. Used for AI context and .txt export.
 */
export function htmlToText(html) {
  if (!html) return "";
  const withBreaks = String(html)
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|tr|div)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n");
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Escape a string for safe interpolation into HTML text or attribute values
 * (&, <, >, and double quotes).
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

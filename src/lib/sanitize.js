import sanitizeHtml from "sanitize-html";

// Every piece of HTML that enters the system (uploads, AI output, exports)
// passes through here so the editor and stored docs stay script-free.

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
};

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
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel", "style"],
    img: ["src", "alt", "width", "height", "style"],
    th: ["colspan", "rowspan", "style"],
    td: ["colspan", "rowspan", "style"],
    ol: ["start", "type", "style"],
  },
  allowedStyles: { "*": STYLE_PROPS },
  allowedSchemes: ["http", "https", "mailto", "data"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function cleanDocHtml(html) {
  if (!html) return "";
  return sanitizeHtml(String(html), OPTIONS).trim();
}

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

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

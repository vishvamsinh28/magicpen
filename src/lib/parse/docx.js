import { wrapPlainText } from "./annotate";

/**
 * DOCX → HTML via mammoth, plus recovery of the styling mammoth drops:
 * highlight colors (mapped through Word's fixed palette) and per-run text
 * color / shading pulled straight out of the DOCX XML.
 */

// Word's fixed highlight palette → hex, so highlighter marks survive import
// (mammoth drops highlights unless mapped explicitly).
const WORD_HIGHLIGHTS = {
  yellow: "#ffff00", green: "#00ff00", cyan: "#00ffff", magenta: "#ff00ff",
  blue: "#0000ff", red: "#ff0000", darkBlue: "#00008b", darkCyan: "#008b8b",
  darkGreen: "#006400", darkMagenta: "#800080", darkRed: "#8b0000",
  darkYellow: "#808000", darkGray: "#a9a9a9", lightGray: "#d3d3d3",
  black: "#000000", white: "#ffffff",
};

// XML entity decode for the handful of entities Word emits inside <w:t>.
const decodeEntities = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

// Styled { color, shading, text } runs of one <w:p>, with consecutive runs of
// identical styling merged so a word split across runs re-finds as one string.
function styledRunsOfParagraph(paragraph) {
  const styled = [];
  let current = null;
  const flush = () => {
    if (current) styled.push(current);
    current = null;
  };
  for (const run of paragraph.match(/<w:r\b[\s\S]*?<\/w:r>/g) || []) {
    let color = run.match(/<w:color[^>]*w:val="([0-9A-Fa-f]{6})"/)?.[1]?.toLowerCase() || null;
    if (color === "000000") color = null; // default text color — not a style
    let shading = run.match(/<w:shd[^>]*w:fill="([0-9A-Fa-f]{6})"/)?.[1]?.toLowerCase() || null;
    if (shading === "ffffff") shading = null; // white shading = no shading
    const text = decodeEntities(
      [...run.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("")
    );
    if (!(color || shading) || !text) {
      flush();
      continue;
    }
    if (current && current.color === color && current.shading === shading) {
      current.text += text;
    } else {
      flush();
      current = { color, shading, text };
    }
  }
  flush();
  return styled;
}

/**
 * Mammoth deliberately drops text colors, and run shading (w:shd) entirely —
 * pull styled runs straight out of the DOCX XML (in document order, merged
 * per paragraph) and re-apply them after conversion. Best-effort: returns []
 * when the XML can't be read so the import still succeeds without colors.
 */
async function extractDocxRunStyles(buffer) {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) return [];

    const styled = [];
    for (const paragraph of xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []) {
      styled.push(...styledRunsOfParagraph(paragraph));
    }
    // Very short runs are unreliable to re-find; very long ones are whole
    // paragraphs where a wrap could misfire.
    return styled
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text.length >= 2 && s.text.length <= 300);
  } catch (err) {
    console.warn("[magicpen] DOCX run-style extraction skipped:", err?.message);
    return [];
  }
}

/**
 * Convert a DOCX buffer to HTML with highlights, text colors, and run shading
 * preserved. Throws with context when mammoth can't read the file (corrupt or
 * password-protected documents).
 */
export async function parseDocx(buffer) {
  let result;
  try {
    const { default: mammoth } = await import("mammoth");
    const styleMap = [
      ...Object.keys(WORD_HIGHLIGHTS).map(
        (color) => `highlight[color='${color}'] => mark.hl-${color}`
      ),
      "highlight => mark.hl-yellow",
    ];
    result = await mammoth.convertToHtml({ buffer }, { styleMap });
  } catch (err) {
    throw new Error(`DOCX conversion failed: ${err.message}`, { cause: err });
  }
  // Classes don't survive sanitization — turn them into inline styles now.
  let html = result.value.replace(/<mark class="hl-(\w+)">/g, (match, color) => {
    const hex = WORD_HIGHLIGHTS[color] || WORD_HIGHLIGHTS.yellow;
    return `<mark style="background-color:${hex}">`;
  });
  // Re-apply the text colors and run shading mammoth dropped. Shading wraps
  // outside, color inside: <mark…><span…>text</span></mark>.
  for (const { text, color, shading } of await extractDocxRunStyles(buffer)) {
    const open =
      (shading ? `<mark style="background-color:#${shading}">` : "") +
      (color ? `<span style="color:#${color}">` : "");
    const close = (color ? "</span>" : "") + (shading ? "</mark>" : "");
    const wrapped = wrapPlainText(html, text, open, close);
    if (wrapped) html = wrapped;
  }
  return html;
}

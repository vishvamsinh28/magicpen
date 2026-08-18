/**
 * PDF annotation extraction: pairs link/markup annotations with the text under
 * their rectangles so hyperlinks and reader markup (highlight, underline,
 * strikeout) can be re-attached to the converted HTML deterministically.
 */

/**
 * Text under an annotation rectangle. Items that start before the rect but
 * overlap it (mid-line links/highlights) contribute a substring sliced by
 * average character width — approximate, but reliable for one-line runs.
 */
function textInRect(textContent, rect) {
  const [x1, y1, x2, y2] = rect;
  const parts = [];
  for (const item of textContent.items) {
    const tx = item.transform?.[4];
    const ty = item.transform?.[5];
    if (tx == null || !item.str) continue;
    if (ty < y1 - 3 || ty > y2 + 3) continue; // baseline outside vertically
    const width = item.width || 0;
    const endX = tx + width;
    if (endX < x1 - 2 || tx > x2 + 2) continue; // no horizontal overlap
    if (tx >= x1 - 2 && endX <= x2 + 2) {
      parts.push(item.str); // fully inside
    } else if (width > 0 && item.str.length > 1) {
      // Proportional slice, then snap outward to word boundaries — average
      // char width is off by a glyph or two on mixed-width text.
      const charWidth = width / item.str.length;
      let from = Math.max(0, Math.round((x1 - tx) / charWidth));
      let to = Math.min(item.str.length, Math.round((x2 - tx) / charWidth));
      while (from > 0 && item.str[from - 1] !== " ") from--;
      while (to < item.str.length && item.str[to] !== " ") to++;
      if (to > from) parts.push(item.str.slice(from, to));
    } else {
      parts.push(item.str);
    }
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * Pair each link annotation's URL with the text under its rectangle, so links
 * can be re-attached deterministically even if the model forgets them.
 * Best-effort: a failure mid-scan returns whatever was collected so far.
 */
export async function extractLinkAnchors(pdf) {
  const anchors = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const linkAnnots = (await page.getAnnotations()).filter((a) => a.url && a.rect);
      if (!linkAnnots.length) continue;
      const textContent = await page.getTextContent();
      for (const annot of linkAnnots) {
        const text = textInRect(textContent, annot.rect);
        anchors.push({ url: annot.url, text: text.length >= 3 && text.length <= 120 ? text : null });
      }
    }
  } catch (err) {
    console.warn("[magicpen] PDF link extraction skipped:", err?.message);
  }
  return anchors;
}

/**
 * Highlight / Underline / StrikeOut annotations (someone marked up the PDF in
 * a reader) → the corresponding editor formatting, with the annotation color.
 * Best-effort like extractLinkAnchors.
 */
export async function extractMarkupAnnotations(pdf) {
  const markups = [];
  const SUBTYPES = { Highlight: "mark", Underline: "u", StrikeOut: "s" };
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const annots = (await page.getAnnotations()).filter((a) => SUBTYPES[a.subtype] && a.rect);
      if (!annots.length) continue;
      const textContent = await page.getTextContent();
      for (const annot of annots) {
        const text = textInRect(textContent, annot.rect);
        if (text.length < 2 || text.length > 200) continue;
        const color =
          annot.color?.length >= 3
            ? `#${[...annot.color].slice(0, 3).map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
            : "#ffff00";
        markups.push({ kind: SUBTYPES[annot.subtype], text, color });
      }
    }
  } catch (err) {
    console.warn("[magicpen] PDF markup extraction skipped:", err?.message);
  }
  return markups;
}

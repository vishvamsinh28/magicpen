"use client";

/**
 * Static option lists for the editor toolbar: fonts, sizes, spacing steps,
 * image widths, and the text/highlight color palettes. Values are the exact
 * strings written into the document, so changing one is a document-format change.
 */

/** Font sizes offered by the Size dropdown; stored on text as `${size}px`. */
export const FONT_SIZES = ["Default", "10", "12", "14", "16", "18", "20", "24", "28", "32"];

/** Line-spacing steps offered by the Spacing dropdown (unitless line-height). */
export const SPACINGS = ["Default", "1.0", "1.15", "1.5", "2.0", "2.5", "3.0"];

/**
 * Font menu entries. `value` is the full font-family stack written into the
 * document (null = clear back to the theme default).
 */
export const FONTS = [
  { label: "Default", value: null },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Garamond", value: "Garamond, 'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

/**
 * Display name for whatever font-family string is on the selection — the first
 * family in the stack, unquoted. Handles stacks pasted from other apps too.
 */
export const fontLabel = (value) => {
  if (!value) return "Default";
  const first = value.split(",")[0].replace(/['"]/g, "").trim();
  return first || "Default";
};

/** Width presets for a selected image; stored as the image's width attribute. */
export const IMAGE_WIDTHS = [
  { label: "Original", value: null },
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "Full width", value: "100%" },
];

/** Text color swatches (null = default ink color). */
export const TEXT_COLORS = [
  { label: "Default", value: null },
  { label: "Gray", value: "#5c6b7a" },
  { label: "Red", value: "#c53929" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber", value: "#b45309" },
  { label: "Green", value: "#1e7f4f" },
  { label: "Blue", value: "#1d63d8" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
];

/** Highlight swatches (null = remove highlight). */
export const HIGHLIGHTS = [
  { label: "None", value: null },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Purple", value: "#e9d5ff" },
];

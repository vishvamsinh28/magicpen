"use client";

/**
 * Image insertion pipeline for the toolbar: read a picked file, downscale it
 * for inline embedding, and insert it at the cursor. Images are stored as
 * base64 data URLs directly in the document HTML.
 */

/**
 * Read + downscale an image for inline embedding (base64 in the doc). Large
 * photos get capped at 1600px wide; PNGs stay PNG so transparency survives,
 * GIFs skip the canvas entirely so animation isn't flattened.
 */
export async function fileToInsertableSrc(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(file);
  });
  if (file.type === "image/gif") return dataUrl; // canvas would lose animation

  const img = await new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That file doesn't look like an image."));
    el.src = dataUrl;
  });
  const MAX_WIDTH = 1600;
  const scale = Math.min(1, MAX_WIDTH / (img.naturalWidth || MAX_WIDTH));
  if (scale === 1 && file.size < 500 * 1024) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // canvas unavailable — fall back to the unscaled original
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.87);
}

/**
 * Validate a picked image file and insert it into the editor at the cursor.
 * Oversized files and read failures surface through `showToast` rather than
 * throwing, so a bad pick never breaks the toolbar.
 */
export async function insertImageFile(editor, file, showToast) {
  if (!file || !editor) return;
  if (file.size > 8 * 1024 * 1024) {
    showToast?.("Images up to 8 MB are supported.");
    return;
  }
  try {
    const src = await fileToInsertableSrc(file);
    editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[a-z0-9]+$/i, "") }).run();
  } catch (err) {
    showToast?.(err.message || "Couldn't insert that image.");
  }
}

/**
 * Raster image extraction and PNG encoding for the PDF parser: pulls embedded
 * images out of a pdf.js document and turns whole rasters or cropped regions
 * into data URIs small enough to inline in editor HTML.
 */

export const MAX_PDF_IMAGES = 8;
const MAX_IMAGE_DATA_URI = 1_500_000;

/**
 * Pull raw raster images out of the PDF (pixel data + dimensions per page).
 * Best-effort: pages whose images can't be decoded are skipped, and any
 * unexpected failure yields [] so the text import still proceeds.
 */
export async function extractRawImages(pdf) {
  const rasters = [];
  try {
    const { extractImages } = await import("unpdf");
    for (let pageNum = 1; pageNum <= pdf.numPages && rasters.length < MAX_PDF_IMAGES; pageNum++) {
      let pageImages = [];
      try {
        pageImages = await extractImages(pdf, pageNum);
      } catch {
        // Undecodable image stream on this page (exotic filter/colorspace) —
        // skip the page rather than fail the whole import.
        continue;
      }
      for (const image of pageImages) {
        if (rasters.length >= MAX_PDF_IMAGES) break;
        const { width, height, channels, data } = image;
        if (!width || !height || !data || width < 24 || height < 24) continue; // skip icons/artifacts
        rasters.push({ page: pageNum, width, height, channels, data });
      }
    }
  } catch (err) {
    console.warn("[magicpen] PDF image extraction skipped:", err.message);
  }
  return rasters;
}

/**
 * Encode a raster region as a PNG data URI. `box` is [ymin,xmin,ymax,xmax]
 * normalized to 0–1000 (whole image when omitted). Nearest-neighbor downscale
 * keeps the longest edge ≤ maxDim. Returns null for degenerate boxes or
 * results too large to inline.
 */
export function encodeRasterRegion(raster, PNG, box = null, maxDim = 1000) {
  const { width, height, channels, data } = raster;
  let x0 = 0, y0 = 0, x1 = width, y1 = height;
  if (box) {
    const PAD = 12; // model boxes run tight — breathe ~1.2% on every side
    const [ymin, xmin, ymax, xmax] = box.map((v) => Math.max(0, Math.min(1000, v)));
    if (ymax - ymin < 8 || xmax - xmin < 8) return null; // degenerate box
    x0 = Math.floor((Math.max(0, xmin - PAD) / 1000) * width);
    x1 = Math.ceil((Math.min(1000, xmax + PAD) / 1000) * width);
    y0 = Math.floor((Math.max(0, ymin - PAD) / 1000) * height);
    y1 = Math.ceil((Math.min(1000, ymax + PAD) / 1000) * height);
  }
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 16 || ch < 16) return null;

  const factor = Math.max(1, Math.ceil(Math.max(cw, ch) / maxDim));
  const w = Math.floor(cw / factor);
  const h = Math.floor(ch / factor);
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y * factor) * width + (x0 + x * factor)) * channels;
      const di = (y * w + x) * 4;
      png.data[di] = data[si];
      png.data[di + 1] = channels >= 3 ? data[si + 1] : data[si];
      png.data[di + 2] = channels >= 3 ? data[si + 2] : data[si];
      png.data[di + 3] = channels === 4 ? data[si + 3] : 255;
    }
  }
  const dataUri = `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
  return dataUri.length > MAX_IMAGE_DATA_URI ? null : dataUri;
}

"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Zoom stepper pinned to the bottom-right of the page. `zoom` is either "fit"
 * (treated as 100% for stepping) or a percent from ZOOM_STEPS; the middle
 * button resets to "fit". The parent applies the value via CSS `zoom`.
 */

const ZOOM_STEPS = [50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];

export default function ZoomControl({ zoom, onZoomChange }) {
  const stepZoom = (dir) => {
    const current = zoom === "fit" ? 100 : zoom;
    const idx = ZOOM_STEPS.findIndex((z) => z >= current);
    const at = idx === -1 ? ZOOM_STEPS.length - 1 : idx;
    const next = ZOOM_STEPS[Math.min(Math.max(at + dir, 0), ZOOM_STEPS.length - 1)];
    onZoomChange(next);
  };

  return (
    <div className="absolute bottom-4 right-4 flex items-center overflow-hidden rounded-md border border-line bg-paper shadow-card">
      <button
        onClick={() => stepZoom(-1)}
        aria-label="Zoom out"
        className="px-2.5 py-1.5 text-ink transition-colors hover:bg-canvas"
      >
        <Minus size={14} strokeWidth={2.2} />
      </button>
      <button
        onClick={() => onZoomChange("fit")}
        className="min-w-[52px] px-2 py-1.5 text-center text-[13px] font-semibold text-ink transition-colors hover:bg-canvas"
        title="Reset zoom"
      >
        {zoom === "fit" ? "Fit" : `${zoom}%`}
      </button>
      <button
        onClick={() => stepZoom(1)}
        aria-label="Zoom in"
        className="px-2.5 py-1.5 text-ink transition-colors hover:bg-canvas"
      >
        <Plus size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}

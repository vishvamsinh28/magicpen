"use client";

import { useMemo } from "react";
import { buildDiffPreviewHtml } from "@/lib/diff";
import { diffHtml } from "@/lib/htmldiff";

/**
 * Static HTML overlays rendered on top of the editor: the red/green review of
 * a pending AI change, and the commit preview (optionally diffed against the
 * current text). A commit preview takes precedence over a pending review.
 * Returns { reviewing, previewingVersion, overlayHtml, overlayActive }.
 */
export function useOverlayHtml(ws) {
  const { pendingChange, pendingDeselected, versionPreview, activeDocId, docHtmlRef } = ws;

  // Proposed changes render on the document itself while awaiting review —
  // but only on the document they were proposed for.
  const reviewing = !!pendingChange && (pendingChange.docId ?? null) === (activeDocId ?? null);
  // Base comes from docHtmlRef, not the editor: on a tab switch this memo runs
  // before the effect that loads the new doc into the editor, so the editor's
  // html can still be the previous tab's. docHtmlRef is kept current on every
  // keystroke and programmatic write.
  const reviewHtml = useMemo(() => {
    if (!reviewing) return null;
    const base = activeDocId ? (docHtmlRef.current.get(activeDocId) ?? "") : "";
    return buildDiffPreviewHtml(pendingChange.edits, base, pendingDeselected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, pendingChange, pendingDeselected, activeDocId]);

  // Commit preview — takes precedence over a pending-change review overlay.
  const previewingVersion = !!versionPreview && versionPreview.docId === activeDocId;
  const versionHtml = useMemo(() => {
    if (!previewingVersion) return null;
    if (!versionPreview.compare) return versionPreview.html;
    const current = activeDocId ? (docHtmlRef.current.get(activeDocId) ?? "") : "";
    return diffHtml(current, versionPreview.html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewingVersion, versionPreview, activeDocId]);

  const overlayHtml = previewingVersion ? versionHtml : reviewing ? reviewHtml : null;
  return { reviewing, previewingVersion, overlayHtml, overlayActive: overlayHtml != null };
}

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

// In-app replacement for window.confirm. Browsers silently suppress repeated
// native dialogs ("prevent this page from creating additional dialogs"),
// which turned confirm-gated actions into no-ops. Sits above every other
// surface (drawers z-60, modals z-70, dropdowns z-90).
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    // Capture phase so Escape closes only this dialog, not the modal or
    // drawer underneath (those listen for Escape on document).
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  // Portal to <body>: hosts like the files modal keep a persistent CSS
  // transform (sd-pop-in fill-mode "both"), which would re-anchor our
  // fixed-position overlay to the scrolled container instead of the viewport.
  return createPortal(
    <div
      className="sd-pop-in fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="absolute inset-0 bg-ink/40" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-frame bg-paper p-5 shadow-pop">
        <p id="confirm-dialog-title" className="break-words text-[16px] font-bold text-ink">
          {title}
        </p>
        {message && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border-[1.5px] border-frame bg-paper px-3.5 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-cream disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-card transition-colors disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-accent hover:bg-accent-deep"
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

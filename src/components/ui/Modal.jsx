"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, variant = "center", children, labelledBy }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  if (variant === "full") {
    return (
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-canvas mp-pop-in" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="fixed right-4 top-4 z-10 rounded-full border border-line bg-paper p-2.5 text-ink shadow-card transition-colors hover:bg-canvas md:right-8 md:top-7"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
        {children}
      </div>
    );
  }

  if (variant === "drawer") {
    return (
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
        <div className="absolute bottom-0 right-0 top-0 w-full max-w-md overflow-y-auto bg-paper shadow-pop mp-slide-in-right">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-paper shadow-pop mp-pop-in">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <X size={17} />
        </button>
        {children}
      </div>
    </div>
  );
}

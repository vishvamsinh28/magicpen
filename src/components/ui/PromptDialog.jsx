"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

// Text-input sibling of ConfirmDialog — replaces window.prompt for the same
// reason: browsers silently suppress repeated native dialogs. Enter submits,
// Escape cancels, and the prefilled value opens selected like window.prompt.
export default function PromptDialog({
  open,
  title,
  placeholder,
  defaultValue = "",
  confirmLabel = "Save",
  allowEmpty = false,
  busy = false,
  onSubmit,
  onCancel,
}) {
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);

  const submit = () => {
    if (busy || (!allowEmpty && !value.trim())) return;
    onSubmit?.(value);
  };

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue ?? "");
    // Focus after the portal mounts; select-all mirrors window.prompt.
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    // Capture phase so Escape closes only this dialog, not a modal beneath.
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="mp-pop-in fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
    >
      <div className="absolute inset-0 bg-ink/40" onClick={busy ? undefined : onCancel} />
      <form
        className="relative w-full max-w-sm rounded-xl border border-line bg-paper p-5 shadow-pop"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <p id="prompt-dialog-title" className="text-[16px] font-bold text-ink">
          {title}
        </p>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Explicit Enter handling — implicit form submission can be
            // skipped for synthesized key events.
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent disabled:opacity-50"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-line-strong bg-paper px-3.5 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || (!allowEmpty && !value.trim())}
            className="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

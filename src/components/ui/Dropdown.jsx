"use client";

import { useEffect, useRef, useState, cloneElement } from "react";

// Popover menu using fixed positioning so it never gets clipped by
// overflow containers (toolbar scroll area, chat composer, etc.).
export default function Dropdown({
  trigger,
  children,
  items,
  align = "left",
  direction = "down",
  menuClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const close = () => setOpen(false);
  const toggle = () => {
    if (!open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen((v) => !v);
  };

  const style = rect
    ? {
        position: "fixed",
        zIndex: 90,
        ...(direction === "up"
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        ...(align === "right"
          ? { right: Math.max(8, window.innerWidth - rect.right) }
          : { left: Math.min(rect.left, window.innerWidth - 240) }),
      }
    : {};

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        {cloneElement(trigger, {
          onClick: (e) => {
            e.preventDefault();
            trigger.props?.onClick?.(e);
            toggle();
          },
          "data-open": open || undefined,
        })}
      </span>
      {open && (
        <div
          ref={menuRef}
          style={style}
          className={`min-w-44 max-w-[260px] rounded-lg border border-line bg-paper p-1 shadow-pop sd-pop-in ${menuClassName}`}
        >
          {items
            ? items.map((item, i) =>
                item === "divider" ? (
                  <div key={i} className="my-1 border-t border-line" />
                ) : (
                  <button
                    key={i}
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      item.danger
                        ? "text-red-700 hover:bg-red-50"
                        : item.active
                          ? "bg-accent-soft font-medium text-accent-deep"
                          : "text-ink hover:bg-cream"
                    }`}
                  >
                    {item.icon && <span className="shrink-0 text-muted">{item.icon}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate leading-tight">{item.label}</span>
                      {item.desc && (
                        <span className="mt-0.5 block text-[11px] leading-tight text-muted">
                          {item.desc}
                        </span>
                      )}
                    </span>
                    {item.right && <span className="shrink-0 text-muted">{item.right}</span>}
                  </button>
                )
              )
            : children?.(close)}
        </div>
      )}
    </>
  );
}

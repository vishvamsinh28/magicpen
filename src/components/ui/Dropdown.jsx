"use client";

import { useEffect, useLayoutEffect, useRef, useState, cloneElement } from "react";
import { createPortal } from "react-dom";

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
  const [flipUp, setFlipUp] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // A menu near the viewport bottom would render its last items (e.g. the
  // file card's Delete) off-screen — measure after mount and open upward
  // instead when it clips and there's room above. Runs before paint.
  useLayoutEffect(() => {
    if (!open || !rect || direction === "up") {
      setFlipUp(false);
      return;
    }
    const box = menuRef.current?.getBoundingClientRect();
    if (!box) return;
    setFlipUp(box.bottom > window.innerHeight - 8 && rect.top > box.height + 12);
  }, [open, rect, direction]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onScroll = (e) => {
      // Also runs for window resize, where e.target is `window` — not a Node,
      // which contains() rejects. Non-Node targets always close the menu.
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
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
        ...(direction === "up" || flipUp
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
      {/* Portal to <body>: hosts with a persistent CSS transform (e.g. the
          files modal's mp-pop-in) re-anchor fixed positioning to themselves,
          which pushed the menu away from its trigger once the host scrolled. */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={style}
            className={`min-w-44 max-w-[260px] rounded-lg border border-line bg-paper p-1 shadow-pop mp-pop-in ${menuClassName}`}
          >
          {items
            ? items.map((item, i) =>
                item === "divider" ? (
                  <div key={i} className="my-1 border-t border-line" />
                ) : item.heading ? (
                  // Non-interactive section label (e.g. "Download" in File).
                  <p key={i} className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                    {item.heading}
                  </p>
                ) : (
                  <button
                    key={i}
                    disabled={item.disabled}
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      item.danger
                        ? "text-red-700 hover:bg-red-50"
                        : item.active
                          ? "bg-accent-soft font-medium text-accent-deep"
                          : "text-ink hover:bg-canvas"
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
                    {item.right && <span className="shrink-0 text-[11px] text-muted">{item.right}</span>}
                  </button>
                )
              )
            : children?.(close)}
          </div>,
          document.body
        )}
    </>
  );
}

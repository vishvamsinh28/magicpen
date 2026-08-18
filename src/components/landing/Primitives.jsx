/**
 * Shared layout atoms for the landing page: the section eyebrow, bullet list,
 * mock-window frame, skeleton text bar, and the two-column Showcase shell
 * that every feature section on the page is built from.
 */

/** Uppercase kicker with a short accent dash, shown above section titles. */
export function Eyebrow({ children }) {
  return (
    <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      <span aria-hidden className="h-px w-7 bg-accent" />
      {children}
    </p>
  );
}

/**
 * Accent-dotted bullet list under a Showcase lede. Items may be plain strings
 * or inline JSX. Internal to Showcase; renders nothing for an empty list.
 */
function Bullets({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-7 space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-soft">
          <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Mock window chrome that borrows the app's own panel frame. `label` renders
 * as an attached title bar above the body content.
 */
export function Frame({ children, className = "", label }) {
  return (
    <div className={`overflow-hidden rounded-[7px] border-[1.5px] border-line-strong bg-paper shadow-pop ${className}`}>
      {label}
      {children}
    </div>
  );
}

/**
 * Skeleton text line for the mock documents; `tone` switches the fill between
 * the neutral line colour and a faint accent.
 */
export function Bar({ w, tone = "line" }) {
  return <div className={`h-[6px] rounded-full ${tone === "line" ? "bg-line" : "bg-accent-faint"}`} style={{ width: w }} />;
}

/**
 * Two-column feature section: copy (eyebrow, title, lede, bullets) beside a
 * visual mock. `flip` swaps the columns on large screens and `tone` alternates
 * the canvas/paper background so adjacent sections stripe. Both columns carry
 * the scroll-reveal animation hook.
 */
export function Showcase({ id, eyebrow, title, lede, items, visual, flip = false, tone = "canvas" }) {
  return (
    <section
      id={id}
      className={`scroll-mt-16 border-t border-line ${tone === "paper" ? "bg-paper" : "bg-canvas"}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
        <div className={`mp-reveal ${flip ? "lg:order-2" : ""}`}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-5 max-w-lg font-display text-[clamp(1.65rem,3.4vw,2.35rem)] font-bold leading-[1.15] tracking-[-0.02em]">
            {title}
          </h2>
          <p className="mt-4 max-w-lg text-[15.5px] leading-[1.7] text-ink-soft">{lede}</p>
          <Bullets items={items} />
        </div>
        <div className={`mp-reveal ${flip ? "lg:order-1" : ""}`}>{visual}</div>
      </div>
    </section>
  );
}

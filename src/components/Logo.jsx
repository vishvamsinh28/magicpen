/**
 * The MagicPen mark — a fountain-pen nib with a magic sparkle, as inline SVG.
 * Decorative only (aria-hidden); pair it with visible text where a label is
 * needed. Server-safe: no client directive so it renders anywhere.
 */
export function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* nib body */}
      <path
        d="M22 10 C28.9 10 34 15.1 34 21.8 C34 29.8 26.4 37.6 22 43 C17.6 37.6 10 29.8 10 21.8 C10 15.1 15.1 10 22 10 Z"
        fill="#1a73e8"
      />
      {/* right-half shading */}
      <path
        d="M22 10 C28.9 10 34 15.1 34 21.8 C34 29.8 26.4 37.6 22 43 Z"
        fill="#174ea6"
      />
      {/* breather hole */}
      <circle cx="22" cy="22.5" r="2.7" fill="#ffffff" />
      {/* slit */}
      <path d="M22 25.8 V38.5" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" />
      {/* sparkle */}
      <path
        d="M38.5 3 L40.4 8.1 L45.5 10 L40.4 11.9 L38.5 17 L36.6 11.9 L31.5 10 L36.6 8.1 Z"
        fill="#1a73e8"
      />
      <circle cx="43.5" cy="18.5" r="1.7" fill="#174ea6" />
    </svg>
  );
}

/**
 * Full lockup: the mark plus the "MagicPen" wordmark.
 * `compact` drops the wordmark (and shrinks the mark) for tight headers.
 */
export default function Logo({ compact = false }) {
  return (
    <span className="flex select-none items-center gap-2">
      <LogoMark size={compact ? 30 : 34} />
      {!compact && (
        <span className="font-display text-[21px] font-bold tracking-tight text-ink">MagicPen</span>
      )}
    </span>
  );
}

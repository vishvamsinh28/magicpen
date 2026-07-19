// The SuperDocs mascot — a little document wearing a cape.
export function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* cape */}
      <path
        d="M12 14 C6 20, 4 30, 7 39 C11 36, 13 35, 15 36 L14 18 Z"
        fill="#e8684a"
      />
      <path
        d="M36 14 C42 20, 44 30, 41 39 C37 36, 35 35, 33 36 L34 18 Z"
        fill="#d5583b"
      />
      {/* sheet */}
      <rect x="13" y="6" width="22" height="30" rx="4" fill="#ffffff" stroke="#23211d" strokeWidth="2.2" />
      {/* folded corner */}
      <path d="M29 6 L35 12 L29 12 Z" fill="#f0eee6" stroke="#23211d" strokeWidth="1.6" strokeLinejoin="round" />
      {/* face */}
      <circle cx="20.5" cy="18.5" r="1.7" fill="#23211d" />
      <circle cx="27.5" cy="18.5" r="1.7" fill="#23211d" />
      <path d="M20.5 24.5 Q24 27.5 27.5 24.5" stroke="#23211d" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      {/* text lines */}
      <path d="M18 31 H30" stroke="#d8d4c8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ compact = false }) {
  return (
    <span className="flex select-none items-center gap-2">
      <LogoMark size={compact ? 30 : 34} />
      {!compact && (
        <span className="text-[21px] font-bold tracking-tight text-ink">SuperDocs</span>
      )}
    </span>
  );
}

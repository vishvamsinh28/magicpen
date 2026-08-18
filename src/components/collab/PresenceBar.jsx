"use client";

// Who else is in the document right now. Peers come from the sync endpoint,
// which expires anyone who hasn't polled recently.

const initials = (name) => {
  const parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
};

const ROLE_LABEL = { owner: "owner", edit: "can edit", comment: "can comment", view: "viewing" };

export default function PresenceBar({ peers = [], selfId = null, max = 4 }) {
  const others = peers.filter((p) => p.id !== selfId);
  if (!others.length) return null;

  const shown = others.slice(0, max);
  const extra = others.length - shown.length;

  return (
    <div className="flex items-center -space-x-1.5" aria-label={`${others.length} other people here`}>
      {shown.map((p) => (
        <span
          key={p.id}
          title={`${p.name}${ROLE_LABEL[p.role] ? ` · ${ROLE_LABEL[p.role]}` : ""}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-paper"
          style={{ background: p.color || "#7b8b9b" }}
        >
          {initials(p.name)}
        </span>
      ))}
      {extra > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-[10px] font-bold text-ink-soft ring-2 ring-paper">
          +{extra}
        </span>
      )}
    </div>
  );
}

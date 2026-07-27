import { randomBytes } from "crypto";
import { Documents, Shares } from "@/lib/store";
import { getUserFromRequest, getGuestFromRequest } from "@/lib/auth";

// Every collaboration route funnels through resolveAccess(): it answers "who is
// this request, and what may they do with this document?". Authority comes from
// exactly two places — owning the document, or presenting a share token for it.
// Nothing else grants access, and a share never confers ownership.

export const ROLES = ["view", "comment", "edit"];
const RANK = { view: 1, comment: 2, edit: 3, owner: 4 };

export const can = (role, need) => (RANK[role] || 0) >= (RANK[need] || 99);

export const newShareToken = () => randomBytes(18).toString("base64url");

// Guests pick (or are assigned) a display colour so presence and comment
// avatars are distinguishable at a glance.
const COLORS = ["#e8684a", "#1d63d8", "#1e7f4f", "#7c3aed", "#db2777", "#b45309", "#0e7490"];
export const colorFor = (id) => {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

const shareToken = (request) =>
  request.headers.get("x-share-token") ||
  new URL(request.url).searchParams.get("shareToken") ||
  null;

// Returns { document, actor, role, allowDownload, share } or null.
// `actor.kind` is "user" for signed-in accounts and "guest" for share visitors.
export async function resolveAccess(request, documentId, { token } = {}) {
  if (!documentId) return null;

  const user = await getUserFromRequest(request);
  const document = user ? await Documents.get(documentId, user.id) : null;

  // Owner path — the document query above already scoped by user id.
  if (user && document) {
    return {
      document,
      actor: { id: user.id, name: user.name || user.email || "You", kind: "user", color: colorFor(user.id) },
      role: "owner",
      allowDownload: true,
      share: null,
    };
  }

  const presented = token || shareToken(request);
  if (!presented) return null;

  const share = await Shares.getByToken(presented);
  if (!share || share.revoked || share.documentId !== documentId) return null;

  const doc = await Documents.get(share.documentId, share.ownerId);
  if (!doc) return null;

  const guest = user ? null : await getGuestFromRequest(request);
  const actor = user
    ? { id: user.id, name: user.name || user.email || "Someone", kind: "user", color: colorFor(user.id) }
    : guest
      ? { id: guest.id, name: guest.name || "Guest", kind: "guest", color: colorFor(guest.id) }
      : null;

  return {
    document: doc,
    actor,
    role: ROLES.includes(share.role) ? share.role : "view",
    allowDownload: share.allowDownload !== false,
    share,
  };
}

export function forbidden(message = "You don't have access to this document") {
  return Response.json({ error: { message, code: "forbidden" } }, { status: 403 });
}

export function notFound(message = "Document not found") {
  return Response.json({ error: { message, code: "not_found" } }, { status: 404 });
}

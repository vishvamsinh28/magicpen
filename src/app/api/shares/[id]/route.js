import { Documents, Shares } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { ROLES } from "@/lib/access";

export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (ROLES.includes(body.role)) patch.role = body.role;
  if (typeof body.allowDownload === "boolean") patch.allowDownload = body.allowDownload;

  const share = await Shares.update(id, user.id, patch);
  if (!share) return Response.json({ error: { message: "Link not found" } }, { status: 404 });
  return Response.json({ share });
}

// Revoking is a delete: the token stops resolving immediately.
export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const share = await Shares.get(id, user.id);
  await Shares.remove(id, user.id);

  // Last link revoked: the document goes back to being private and single-player.
  if (share) {
    const left = await Shares.listForDocument(share.documentId, user.id);
    if (!left.length) await Documents.update(share.documentId, user.id, { shared: false });
  }
  return Response.json({ ok: true });
}

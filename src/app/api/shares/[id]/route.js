import { Documents, Shares } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { ROLES } from "@/lib/access";

const storeError = (err, action) => {
  console.error(`[magicpen] share ${action} failed:`, err);
  return Response.json(
    { error: { message: `Couldn't ${action} the link. Please try again.` } },
    { status: 500 }
  );
};

/**
 * PATCH /api/shares/[id] — change a share link's role or download setting.
 * Only known roles and boolean allowDownload values are applied; anything
 * else is ignored rather than rejected.
 */
export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (ROLES.includes(body?.role)) patch.role = body.role;
  if (typeof body?.allowDownload === "boolean") patch.allowDownload = body.allowDownload;

  try {
    const share = await Shares.update(id, user.id, patch);
    if (!share) return Response.json({ error: { message: "Link not found" } }, { status: 404 });
    return Response.json({ share });
  } catch (err) {
    return storeError(err, "update");
  }
}

/**
 * DELETE /api/shares/[id] — revoke a share link (the token stops resolving).
 * When the last link on a document is revoked, the document is flipped back
 * to private/single-player mode.
 */
export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const share = await Shares.get(id, user.id);
    await Shares.remove(id, user.id);

    // Last link revoked: the document goes back to being private and single-player.
    if (share) {
      const left = await Shares.listForDocument(share.documentId, user.id);
      if (!left.length) await Documents.update(share.documentId, user.id, { shared: false });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return storeError(err, "revoke");
  }
}

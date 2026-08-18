import { Documents, Shares } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { ROLES, newShareToken } from "@/lib/access";

// Share links for a document. Only the owner may list or mint them.

const storeError = (err, action, message) => {
  console.error(`[magicpen] share ${action} failed:`, err);
  return Response.json({ error: { message } }, { status: 500 });
};

/**
 * GET /api/shares?documentId=… — list the active links for an owned document.
 * Revoked links are filtered out; asking about someone else's document
 * answers 404, same as a missing one.
 */
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) {
    return Response.json({ error: { message: "documentId is required" } }, { status: 400 });
  }

  try {
    const document = await Documents.get(documentId, user.id);
    if (!document) return Response.json({ error: { message: "Document not found" } }, { status: 404 });

    const shares = (await Shares.listForDocument(documentId, user.id)).filter((s) => !s.revoked);
    return Response.json({ shares });
  } catch (err) {
    return storeError(err, "list", "Couldn't load the share links. Please try again.");
  }
}

/**
 * POST /api/shares — mint a new share link for an owned document.
 * Unknown roles fall back to "view". Creating any link also flags the
 * document as shared, which switches the workspace into live-sync mode.
 */
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { documentId, role = "view", allowDownload = true } = body ?? {};

  try {
    const document = documentId ? await Documents.get(documentId, user.id) : null;
    if (!document) return Response.json({ error: { message: "Document not found" } }, { status: 404 });

    const share = await Shares.create({
      ownerId: user.id,
      documentId,
      token: newShareToken(),
      role: ROLES.includes(role) ? role : "view",
      allowDownload: allowDownload !== false,
    });
    // The flag tells the workspace to switch this document into live-sync mode
    // without having to query the share list on every open.
    await Documents.update(documentId, user.id, { shared: true });
    return Response.json({ share });
  } catch (err) {
    return storeError(err, "create", "Couldn't create the link. Please try again.");
  }
}

import { Documents, Shares } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { ROLES, newShareToken } from "@/lib/access";

// Share links for a document. Only the owner may list or mint them.

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) {
    return Response.json({ error: { message: "documentId is required" } }, { status: 400 });
  }
  const document = await Documents.get(documentId, user.id);
  if (!document) return Response.json({ error: { message: "Document not found" } }, { status: 404 });

  const shares = (await Shares.listForDocument(documentId, user.id)).filter((s) => !s.revoked);
  return Response.json({ shares });
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { documentId, role = "view", allowDownload = true } = body;

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
}

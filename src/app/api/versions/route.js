import { Documents, Versions } from "@/lib/store";
import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

// Manual commits for a document. Listing returns metadata only — the full
// snapshot is fetched per-version via /api/versions/[id] when needed.

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) {
    return Response.json({ error: { message: "documentId is required" } }, { status: 400 });
  }
  const versions = (await Versions.list(documentId, user.id)).map(
    ({ contentHtml, ...meta }) => meta
  );
  return Response.json({ versions });
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { documentId, label = "", contentHtml = "" } = body;

  const document = documentId ? await Documents.get(documentId, user.id) : null;
  if (!document) {
    return Response.json({ error: { message: "Document not found" } }, { status: 404 });
  }

  const version = await Versions.add({
    userId: user.id,
    documentId,
    label: String(label).trim().slice(0, 120),
    contentHtml: cleanDocHtml(contentHtml),
  });
  const { contentHtml: _omit, ...meta } = version;
  return Response.json({ version: meta });
}

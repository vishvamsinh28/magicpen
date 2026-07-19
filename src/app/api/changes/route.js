import { Changes, Documents } from "@/lib/store";
import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) return Response.json({ changes: [] });
  const changes = await Changes.list(documentId, user.id);
  return Response.json({ changes });
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { documentId, chatId = null, summary, ops = [], beforeHtml = "", afterHtml = "", status = "applied" } = body;

  if (!documentId || !summary) {
    return Response.json({ error: { message: "documentId and summary are required" } }, { status: 400 });
  }
  const document = await Documents.get(documentId, user.id);
  if (!document) {
    return Response.json({ error: { message: "Document not found" } }, { status: 404 });
  }

  const change = await Changes.add({
    userId: user.id,
    documentId,
    chatId,
    summary: String(summary).slice(0, 300),
    ops,
    beforeHtml: cleanDocHtml(beforeHtml),
    afterHtml: cleanDocHtml(afterHtml),
    status: ["applied", "pending", "rejected", "restored"].includes(status) ? status : "applied",
  });
  return Response.json({ change }, { status: 201 });
}

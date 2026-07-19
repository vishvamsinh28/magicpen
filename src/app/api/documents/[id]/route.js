import { Documents } from "@/lib/store";
import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { removeStoredFile } from "@/lib/storage";

export async function GET(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const document = await Documents.get(id, user.id);
  if (!document) return Response.json({ error: { message: "Document not found" } }, { status: 404 });
  return Response.json({ document });
}

export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (typeof body.contentHtml === "string") patch.contentHtml = cleanDocHtml(body.contentHtml);
  const document = await Documents.update(id, user.id, patch);
  if (!document) return Response.json({ error: { message: "Document not found" } }, { status: 404 });
  return Response.json({ document });
}

export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const document = await Documents.get(id, user.id);
  await Documents.remove(id, user.id);
  if (document?.sourceFile?.storage?.path) {
    await removeStoredFile(document.sourceFile.storage.path);
  }
  return Response.json({ ok: true });
}

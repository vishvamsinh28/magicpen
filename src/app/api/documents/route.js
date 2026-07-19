import { Documents } from "@/lib/store";
import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const documents = await Documents.list(user.id);
  return Response.json({
    documents: documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      sourceFile: doc.sourceFile ? { name: doc.sourceFile.name, type: doc.sourceFile.type } : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      // Truncated + re-sanitized so the files grid can render a mini preview.
      previewHtml: cleanDocHtml((doc.contentHtml || "").slice(0, 4000)),
    })),
  });
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const document = await Documents.create({
    userId: user.id,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled document",
    contentHtml: cleanDocHtml(body.contentHtml || ""),
  });
  return Response.json({ document }, { status: 201 });
}

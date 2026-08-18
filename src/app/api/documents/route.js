import { Documents } from "@/lib/store";
import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

const storeError = (err, action, message) => {
  console.error(`[magicpen] documents ${action} failed:`, err);
  return Response.json({ error: { message } }, { status: 500 });
};

/**
 * GET /api/documents — list the user's documents for the files grid.
 * Returns metadata plus a truncated, re-sanitized `previewHtml` slice so the
 * grid can render mini previews without shipping whole documents.
 */
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
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
  } catch (err) {
    return storeError(err, "load", "Couldn't load your documents. Please try again.");
  }
}

/**
 * POST /api/documents — create a document, optionally seeded with content.
 * The title falls back to "Untitled document" and incoming HTML is always
 * sanitized before it is stored.
 */
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  try {
    const document = await Documents.create({
      userId: user.id,
      title: typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Untitled document",
      contentHtml: cleanDocHtml(body?.contentHtml || ""),
    });
    return Response.json({ document }, { status: 201 });
  } catch (err) {
    return storeError(err, "create", "Couldn't create the document. Please try again.");
  }
}

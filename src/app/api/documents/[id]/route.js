import { Documents } from "@/lib/store";
import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { removeStoredFile } from "@/lib/storage";
import { resolveAccess, can, forbidden, notFound } from "@/lib/access";

const storeError = (err, action) => {
  console.error(`[magicpen] document ${action} failed:`, err);
  return Response.json(
    { error: { message: `Couldn't ${action} the document. Please try again.` } },
    { status: 500 }
  );
};

/**
 * GET /api/documents/[id] — fetch one document the signed-in user owns.
 * Owner-only: share visitors read through /api/share/[token] instead.
 */
export async function GET(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const document = await Documents.get(id, user.id);
    if (!document) return Response.json({ error: { message: "Document not found" } }, { status: 404 });
    return Response.json({ document });
  } catch (err) {
    return storeError(err, "load");
  }
}

/**
 * PATCH /api/documents/[id] — save title/content changes.
 * Goes through resolveAccess so collaborators holding an edit link can write
 * too — the update is then applied under the owner's id, since documents
 * stay owned by the person who created them.
 */
export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const access = await resolveAccess(request, id);
    if (!access) return notFound();
    if (!can(access.role, "edit")) return forbidden("You have read-only access to this document");

    const body = await request.json().catch(() => ({}));
    const patch = {};
    if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
    if (typeof body?.contentHtml === "string") patch.contentHtml = cleanDocHtml(body.contentHtml);

    const ownerId = access.share ? access.share.ownerId : access.actor.id;
    const document = await Documents.update(id, ownerId, patch);
    if (!document) return notFound();
    return Response.json({ document });
  } catch (err) {
    return storeError(err, "save");
  }
}

/**
 * DELETE /api/documents/[id] — delete a document the user owns.
 * Also removes the archived original from storage when one exists; the
 * response is ok even if the document was already gone.
 */
export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const document = await Documents.get(id, user.id);
    await Documents.remove(id, user.id);
    if (document?.sourceFile?.storage?.path) {
      await removeStoredFile(document.sourceFile.storage.path);
    }
    return Response.json({ ok: true });
  } catch (err) {
    return storeError(err, "delete");
  }
}

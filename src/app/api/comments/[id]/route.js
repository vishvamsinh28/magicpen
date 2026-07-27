import { Comments } from "@/lib/store";
import { resolveAccess, can, forbidden, notFound } from "@/lib/access";

// Editing a comment is author-only. Resolving is a thread-level action any
// collaborator can take, mirroring how review comments work elsewhere.

export async function PATCH(request, { params }) {
  const { id } = await params;
  const comment = await Comments.get(id);
  if (!comment) return notFound("Comment not found");

  const access = await resolveAccess(request, comment.documentId);
  if (!access) return notFound();
  if (!can(access.role, "comment")) return forbidden("You don't have access to comments");

  const body = await request.json().catch(() => ({}));
  const isAuthor = access.actor && access.actor.id === comment.authorId;

  if (typeof body.text === "string") {
    if (!isAuthor) return forbidden("Only the author can edit a comment");
    const clean = body.text.trim().slice(0, 4000);
    if (!clean) return Response.json({ error: { message: "Comment can't be empty" } }, { status: 400 });
    await Comments.update(id, { body: clean });
  }

  if (typeof body.resolved === "boolean") {
    const thread = (await Comments.listForDocument(comment.documentId)).filter(
      (c) => c.threadId === comment.threadId
    );
    for (const c of thread) {
      await Comments.update(c.id, {
        resolved: body.resolved,
        resolvedBy: body.resolved ? access.actor?.name || null : null,
      });
    }
  }

  return Response.json({ comment: await Comments.get(id) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const comment = await Comments.get(id);
  if (!comment) return Response.json({ ok: true });

  const access = await resolveAccess(request, comment.documentId);
  if (!access) return notFound();

  const isAuthor = access.actor && access.actor.id === comment.authorId;
  const isOwner = access.role === "owner";
  if (!isAuthor && !isOwner) return forbidden("Only the author or the owner can delete this");

  // Deleting the first comment of a thread removes the whole thread.
  const thread = (await Comments.listForDocument(comment.documentId)).filter(
    (c) => c.threadId === comment.threadId
  );
  const isRoot = thread.length > 0 && thread[0].id === comment.id;
  if (isRoot) await Comments.removeThread(comment.documentId, comment.threadId);
  else await Comments.remove(id);

  return Response.json({ ok: true });
}

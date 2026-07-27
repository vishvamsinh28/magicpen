import { randomUUID } from "crypto";
import { Comments } from "@/lib/store";
import { resolveAccess, can, forbidden, notFound } from "@/lib/access";

// Comment threads for a document. Comments never touch the document content —
// each thread stores the quoted text plus the offset it was anchored at, and
// the editor re-finds that range at render time. That keeps commenting
// available to people who have no write access, and keeps anchors from
// fighting with concurrent edits.

export async function GET(request) {
  const documentId = new URL(request.url).searchParams.get("documentId");
  const access = await resolveAccess(request, documentId);
  if (!access) return notFound();
  if (!can(access.role, "comment")) return forbidden("You don't have access to comments");

  const comments = await Comments.listForDocument(documentId);
  return Response.json({ comments, actor: access.actor, role: access.role });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { documentId, threadId, text, quote = "", anchorStart = null } = body;

  const access = await resolveAccess(request, documentId);
  if (!access) return notFound();
  if (!can(access.role, "comment")) return forbidden("You don't have access to comment");
  if (!access.actor) {
    return Response.json({ error: { message: "Tell us your name to comment" } }, { status: 400 });
  }

  const clean = String(text || "").trim().slice(0, 4000);
  if (!clean) return Response.json({ error: { message: "Comment can't be empty" } }, { status: 400 });

  // Replies join an existing thread; a new thread gets a fresh id and keeps
  // the anchor. Replying to a thread that doesn't exist starts a new one.
  const existing = threadId
    ? (await Comments.listForDocument(documentId)).filter((c) => c.threadId === threadId)
    : [];
  const isReply = existing.length > 0;

  const comment = await Comments.create({
    documentId,
    threadId: isReply ? threadId : threadId || randomUUID(),
    authorId: access.actor.id,
    authorName: access.actor.name,
    authorKind: access.actor.kind,
    body: clean,
    quote: isReply ? "" : String(quote || "").slice(0, 400),
  });

  if (!isReply) {
    await Comments.update(comment.id, {
      anchorStart: Number.isFinite(anchorStart) ? anchorStart : null,
    });
    comment.anchorStart = Number.isFinite(anchorStart) ? anchorStart : null;
  }

  return Response.json({ comment });
}

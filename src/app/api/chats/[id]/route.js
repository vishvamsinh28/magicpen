import { Chats, Messages } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

const storeError = (err, action) => {
  console.error(`[magicpen] chat ${action} failed:`, err);
  return Response.json(
    { error: { message: `Couldn't ${action} the chat. Please try again.` } },
    { status: 500 }
  );
};

/**
 * GET /api/chats/[id] — fetch one chat with its full message history.
 * Scoped to the signed-in user; a chat owned by someone else is
 * indistinguishable from a missing one (both 404).
 */
export async function GET(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const chat = await Chats.get(id, user.id);
    if (!chat) return Response.json({ error: { message: "Chat not found" } }, { status: 404 });
    const messages = await Messages.list(id);
    return Response.json({ chat, messages });
  } catch (err) {
    return storeError(err, "load");
  }
}

/**
 * PATCH /api/chats/[id] — rename a chat.
 * Only a non-empty title is applied (trimmed, capped at 120 chars); anything
 * else is ignored so a bad payload can't blank the title.
 */
export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 120);

  try {
    const chat = await Chats.update(id, user.id, patch);
    if (!chat) return Response.json({ error: { message: "Chat not found" } }, { status: 404 });
    return Response.json({ chat });
  } catch (err) {
    return storeError(err, "update");
  }
}

/**
 * DELETE /api/chats/[id] — delete a chat (and, via the store, its messages).
 * Idempotent: deleting a chat that's already gone still answers ok.
 */
export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    await Chats.remove(id, user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return storeError(err, "delete");
  }
}

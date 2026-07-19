import { Chats, Messages } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

export async function GET(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const chat = await Chats.get(id, user.id);
  if (!chat) return Response.json({ error: { message: "Chat not found" } }, { status: 404 });
  const messages = await Messages.list(id);
  return Response.json({ chat, messages });
}

export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 120);
  const chat = await Chats.update(id, user.id, patch);
  if (!chat) return Response.json({ error: { message: "Chat not found" } }, { status: 404 });
  return Response.json({ chat });
}

export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  await Chats.remove(id, user.id);
  return Response.json({ ok: true });
}

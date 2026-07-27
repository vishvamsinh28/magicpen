import { Versions } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

export async function GET(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const version = await Versions.get(id, user.id);
  if (!version) return Response.json({ error: { message: "Version not found" } }, { status: 404 });
  return Response.json({ version });
}

export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (typeof body.label === "string") patch.label = body.label.trim().slice(0, 120);
  const version = await Versions.update(id, user.id, patch);
  if (!version) return Response.json({ error: { message: "Version not found" } }, { status: 404 });
  const { contentHtml: _omit, ...meta } = version;
  return Response.json({ version: meta });
}

export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  await Versions.remove(id, user.id);
  return Response.json({ ok: true });
}

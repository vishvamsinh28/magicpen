import { Changes } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (["applied", "pending", "rejected", "restored"].includes(body.status)) patch.status = body.status;
  const change = await Changes.update(id, user.id, patch);
  if (!change) return Response.json({ error: { message: "Change not found" } }, { status: 404 });
  return Response.json({ change });
}

import { Changes } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

/**
 * PATCH /api/changes/[id] — update a change's review status.
 * Only whitelisted status values are accepted; anything else leaves the
 * record untouched (the update simply carries an empty patch).
 */
export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (["applied", "pending", "rejected", "restored"].includes(body?.status)) patch.status = body.status;

  try {
    const change = await Changes.update(id, user.id, patch);
    if (!change) return Response.json({ error: { message: "Change not found" } }, { status: 404 });
    return Response.json({ change });
  } catch (err) {
    console.error("[magicpen] change update failed:", err);
    return Response.json(
      { error: { message: "Couldn't update the change. Please try again." } },
      { status: 500 }
    );
  }
}

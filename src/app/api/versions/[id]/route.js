import { Versions } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

const storeError = (err, action) => {
  console.error(`[magicpen] version ${action} failed:`, err);
  return Response.json(
    { error: { message: `Couldn't ${action} the version. Please try again.` } },
    { status: 500 }
  );
};

/**
 * GET /api/versions/[id] — fetch one version including its full snapshot.
 * This is the only versions endpoint that returns contentHtml; the list
 * endpoint strips it to keep responses small.
 */
export async function GET(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const version = await Versions.get(id, user.id);
    if (!version) return Response.json({ error: { message: "Version not found" } }, { status: 404 });
    return Response.json({ version });
  } catch (err) {
    return storeError(err, "load");
  }
}

/**
 * PATCH /api/versions/[id] — rename a version's label.
 * Responds with metadata only — the snapshot is stripped so a rename
 * round-trip stays light.
 */
export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (typeof body?.label === "string") patch.label = body.label.trim().slice(0, 120);

  try {
    const version = await Versions.update(id, user.id, patch);
    if (!version) return Response.json({ error: { message: "Version not found" } }, { status: 404 });
    const { contentHtml: _omit, ...meta } = version;
    return Response.json({ version: meta });
  } catch (err) {
    return storeError(err, "update");
  }
}

/**
 * DELETE /api/versions/[id] — delete a saved version.
 * Idempotent: a version that's already gone still answers ok.
 */
export async function DELETE(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    await Versions.remove(id, user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return storeError(err, "delete");
  }
}

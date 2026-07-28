import { verifyAddonSecret } from "@/lib/gdocs";
import { connectUrlForGoogleUser } from "@/lib/gdocs-actions";

// Hands the add-on a fresh connect link for an explicit "Connect SuperDocs"
// button in the sidebar. (The assist endpoint also returns a connectUrl when it
// finds the user unlinked, so this is only needed for the up-front button.)
// Auth is the shared add-on secret.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(request) {
  if (!verifyAddonSecret(request.headers.get("x-superdocs-addon"))) {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const googleUserId = String(body.googleUserId || "").trim().toLowerCase();
  if (!googleUserId) return json({ ok: false, code: "missing_user" }, 400);

  const connectUrl = await connectUrlForGoogleUser(googleUserId);
  return json({ ok: true, connectUrl });
}

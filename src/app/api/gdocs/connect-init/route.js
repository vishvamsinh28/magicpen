import { verifyAddonSecret } from "@/lib/gdocs";
import { connectUrlForGoogleUser } from "@/lib/gdocs-actions";

// Hands the add-on a fresh connect link for an explicit "Connect MagicPen"
// button in the sidebar. (The assist endpoint also returns a connectUrl when it
// finds the user unlinked, so this is only needed for the up-front button.)
// Auth is the shared add-on secret.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => Response.json(body, { status });

/**
 * POST /api/gdocs/connect-init — mint a signed account-linking URL.
 * Uses the add-on's `{ ok, code }` wire shape; the connect URL embeds a
 * short-lived state token, so links must be requested fresh each time.
 */
export async function POST(request) {
  const addonSecret = request.headers.get("x-magicpen-addon");
  if (!verifyAddonSecret(addonSecret)) {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const googleUserId = String(body?.googleUserId || "").trim().toLowerCase();
  if (!googleUserId) return json({ ok: false, code: "missing_user" }, 400);

  try {
    const connectUrl = await connectUrlForGoogleUser(googleUserId);
    return json({ ok: true, connectUrl });
  } catch (err) {
    console.error("[magicpen/gdocs] connect-init failed:", err);
    return json({ ok: false, code: "server_error" }, 500);
  }
}

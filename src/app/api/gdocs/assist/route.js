import { verifyAddonSecret } from "@/lib/gdocs";
import { resolveUserByGoogleId, connectUrlForGoogleUser, assistOnDoc } from "@/lib/gdocs-actions";

// The Google Docs add-on's edit endpoint. The sidebar sends the doc's current
// HTML + a natural-language instruction; we run the assistant and return the new
// HTML for the add-on to write back. Auth is the shared add-on secret (there's
// no Slack-style request signature here — the add-on is a first-party client we
// control). If the Google user hasn't linked a SuperDocs account, we return a
// `not_linked` result carrying a connect URL the sidebar shows instead.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body, status = 200) => Response.json(body, { status });

// Mirror of slack-actions' aiErrorText: turn an assistant error into a message
// the sidebar can show verbatim.
function aiErrorMessage(err) {
  if (err.code === "ai_not_configured") return "The AI isn't configured on the server yet (missing GEMINI_API_KEY).";
  if (err.code === "ai_quota") return err.message;
  return "The AI request failed — please try again.";
}

export async function POST(request) {
  if (!verifyAddonSecret(request.headers.get("x-superdocs-addon"))) {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "bad_request" }, 400);
  }

  // Emails are case-insensitive; normalize so the link written by the browser
  // flow and the lookup here always agree.
  const googleUserId = String(body.googleUserId || "").trim().toLowerCase();
  const message = String(body.message || "").trim();
  if (!googleUserId) return json({ ok: false, code: "missing_user" }, 400);
  if (!message) return json({ ok: false, code: "missing_message" }, 400);

  const user = await resolveUserByGoogleId(googleUserId);
  if (!user) {
    const connectUrl = await connectUrlForGoogleUser(googleUserId);
    return json({ ok: false, code: "not_linked", connectUrl });
  }

  try {
    const result = await assistOnDoc({
      title: body.title,
      html: body.html,
      message,
      mode: body.mode,
    });
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("[superdocs/gdocs] assist failed:", err);
    return json({ ok: false, code: err.code || "ai_error", message: aiErrorMessage(err) });
  }
}

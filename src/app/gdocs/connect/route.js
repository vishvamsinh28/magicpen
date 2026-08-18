import { getUserFromRequest } from "@/lib/auth";
import { verifyConnectState, appBaseUrl } from "@/lib/gdocs";
import { GoogleLinks } from "@/lib/store";
import { escapeHtml } from "@/lib/sanitize";

// Account-linking landing for the Google Docs add-on — the twin of
// /slack/connect. The add-on sends the user here with a short-lived signed
// `state` carrying their Google identity. We prove the MagicPen session from
// the browser cookie, then map googleUserId -> MagicPen account. GET renders a
// confirmation; POST performs the link.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bare-tab result page (the visitor arrives from the add-on sidebar, outside
// the app shell). All dynamic text is escaped before interpolation.
function html(title, heading, body) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapeHtml(title)}</title><style>` +
      `body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#f9fbfd;color:#1f1f1f;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center}` +
      `.card{background:#fff;border:1px solid #dadce0;border-radius:14px;padding:32px 36px;max-width:440px;box-shadow:0 6px 24px rgba(60,64,67,.08)}` +
      `h1{font-size:20px;margin:0 0 10px}p{line-height:1.55;margin:8px 0;color:#444746}a{color:#1a73e8}` +
      `button{margin-top:14px;background:#1a73e8;color:#fff;border:0;border-radius:9px;padding:11px 20px;font-size:15px;font-weight:600;cursor:pointer}` +
      `.muted{color:#5f6368;font-size:13px}` +
      `</style></head><body><div class="card"><h1>${escapeHtml(heading)}</h1>${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

const expired = () =>
  html("Link expired", "This link has expired", `<p>Connect links are valid for 15 minutes. Head back to your Google Doc and open the MagicPen sidebar to try again.</p>`);

const signInFirst = () =>
  html(
    "Sign in to MagicPen",
    "Sign in first",
    `<p>Sign in to your MagicPen account, then return to your Google Doc and tap <strong>Connect MagicPen</strong> again.</p>` +
      `<p><a href="${escapeHtml(appBaseUrl())}/login">Sign in to MagicPen →</a></p>`
  );

/**
 * GET /gdocs/connect?state=… — show the "link this account" confirmation.
 * The signed state proves the Google identity; the browser cookie proves the
 * MagicPen session. `?linked=1` renders the post-link success page.
 */
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  if (params.get("linked") === "1") {
    return html("Connected", "✅ Connected", `<p>Your Google account is now linked to MagicPen. Head back to your Google Doc and open the MagicPen sidebar.</p>`);
  }

  const state = params.get("state");
  const verified = await verifyConnectState(state);
  if (!verified) return expired();

  const user = await getUserFromRequest(request);
  if (!user) return signInFirst();

  return html(
    "Connect MagicPen",
    "Connect Google Docs to MagicPen",
    `<p>Link the Google Docs add-on to your MagicPen account:</p>` +
      `<p><strong>${escapeHtml(user.email || user.name || "your account")}</strong></p>` +
      `<form method="POST"><input type="hidden" name="state" value="${escapeHtml(state)}">` +
      `<button type="submit">Connect this account</button></form>` +
      `<p class="muted">Not you? Sign out of MagicPen and sign in as the right account first.</p>`
  );
}

/**
 * POST /gdocs/connect — perform the googleUserId → account link.
 * Re-verifies the state token from the form (so an expired confirmation page
 * can't complete a link) and normalizes the email-shaped id to lowercase.
 */
export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const state = form?.get("state");
  const verified = await verifyConnectState(state);
  if (!verified) return expired();

  const user = await getUserFromRequest(request);
  if (!user) return signInFirst();

  try {
    await GoogleLinks.link({
      googleUserId: String(verified.googleUserId).trim().toLowerCase(),
      userId: user.id,
    });
  } catch (err) {
    console.error("[magicpen/gdocs] account link failed:", err);
    return html(
      "Something went wrong",
      "Something went wrong",
      `<p>We couldn't link your account. Head back to your Google Doc and try again.</p>`
    );
  }

  return html(
    "Connected",
    "✅ Connected",
    `<p><strong>${escapeHtml(user.email || "Your account")}</strong> is now linked to the Google Docs add-on.</p>` +
      `<p>Head back to your Google Doc, open the <strong>MagicPen</strong> sidebar, and start editing — try <em>"tighten the intro"</em>.</p>`
  );
}

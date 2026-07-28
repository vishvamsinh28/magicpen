import { getUserFromRequest } from "@/lib/auth";
import { verifyConnectState, appBaseUrl } from "@/lib/slack";
import { SlackLinks } from "@/lib/store";
import { escapeHtml } from "@/lib/sanitize";

// Account-linking landing. The Slack bot sends the user here with a short-lived
// signed `state` carrying their Slack identity. We prove the SuperDocs session
// from the browser cookie, then map (team, slackUser) -> SuperDocs account.
// GET renders a confirmation; POST performs the link.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(title, heading, body) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapeHtml(title)}</title><style>` +
      `body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#f7f7f5;color:#1f1e1b;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center}` +
      `.card{background:#fff;border:1px solid #e6e4df;border-radius:14px;padding:32px 36px;max-width:440px;box-shadow:0 6px 24px rgba(0,0,0,.05)}` +
      `h1{font-size:20px;margin:0 0 10px}p{line-height:1.55;margin:8px 0;color:#4a4842}a{color:#1d63d8}` +
      `button{margin-top:14px;background:#1d63d8;color:#fff;border:0;border-radius:9px;padding:11px 20px;font-size:15px;font-weight:600;cursor:pointer}` +
      `.muted{color:#8a8880;font-size:13px}` +
      `</style></head><body><div class="card"><h1>${escapeHtml(heading)}</h1>${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

const expired = () =>
  html("Link expired", "This link has expired", `<p>Connect links are valid for 15 minutes. Head back to Slack and try again.</p>`);

const signInFirst = () =>
  html(
    "Sign in to SuperDocs",
    "Sign in first",
    `<p>Sign in to your SuperDocs account, then return to Slack and tap <strong>Connect SuperDocs</strong> again.</p>` +
      `<p><a href="${escapeHtml(appBaseUrl())}/login">Sign in to SuperDocs →</a></p>`
  );

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  if (params.get("linked") === "1") {
    return html("Connected", "✅ Connected", `<p>Your Slack is now linked to SuperDocs. Head back to Slack and start creating.</p>`);
  }

  const state = params.get("state");
  const verified = await verifyConnectState(state);
  if (!verified) return expired();

  const user = await getUserFromRequest(request);
  if (!user) return signInFirst();

  return html(
    "Connect SuperDocs",
    "Connect Slack to SuperDocs",
    `<p>Link this Slack workspace to your SuperDocs account:</p>` +
      `<p><strong>${escapeHtml(user.email || user.name || "your account")}</strong></p>` +
      `<form method="POST"><input type="hidden" name="state" value="${escapeHtml(state)}">` +
      `<button type="submit">Connect this account</button></form>` +
      `<p class="muted">Not you? Sign out of SuperDocs and sign in as the right account first.</p>`
  );
}

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const state = form?.get("state");
  const verified = await verifyConnectState(state);
  if (!verified) return expired();

  const user = await getUserFromRequest(request);
  if (!user) return signInFirst();

  await SlackLinks.link({
    teamId: verified.teamId,
    slackUserId: verified.slackUserId,
    userId: user.id,
  });

  return html(
    "Connected",
    "✅ Connected",
    `<p><strong>${escapeHtml(user.email || "Your account")}</strong> is now linked to Slack.</p>` +
      `<p>Head back to Slack and start creating — try <code>/superdoc new my-doc</code>, then reply in the thread.</p>`
  );
}

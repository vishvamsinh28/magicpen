import { SignJWT, jwtVerify } from "jose";
import { SlackApiError } from "./api";
import { slackRedirectUri } from "./urls";

// Workspace install (OAuth v2) + the signed "connect" state used by the
// browser account-linking flow. The connect state is a short-lived JWT signed
// with the Slack signing secret (always present when Slack is configured), so
// there's no extra secret to manage.

/**
 * Exchanges the install `code` for this workspace's bot token via
 * oauth.v2.access (urlencoded, as Slack expects). Returns a normalized install
 * record; throws SlackApiError when Slack rejects the exchange.
 */
export async function exchangeInstallCode(code) {
  let res;
  try {
    res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID || "",
        client_secret: process.env.SLACK_CLIENT_SECRET || "",
        redirect_uri: slackRedirectUri(),
      }),
    });
  } catch (err) {
    throw new Error(`Slack oauth.v2.access request failed: ${err.message}`, { cause: err });
  }
  const data = await res.json().catch(() => ({ ok: false, error: "invalid_json_response" }));
  if (!data.ok) throw new SlackApiError("oauth.v2.access", data.error, data);
  return {
    teamId: data.team?.id || null,
    teamName: data.team?.name || null,
    botToken: data.access_token || null, // xoxb- bot token
    botUserId: data.bot_user_id || null,
    appId: data.app_id || null,
    authedUserId: data.authed_user?.id || null,
    scope: data.scope || "",
  };
}

/* --------------------------- connect-link state --------------------------- */

// Falls back to a fixed dev secret only when Slack isn't configured at all —
// verifySlackSignature already refuses everything in that state.
const stateSecret = () =>
  new TextEncoder().encode(process.env.SLACK_SIGNING_SECRET || "magicpen-slack-dev");

/**
 * Signs a short-lived (15 min) JWT carrying the Slack identity through the
 * browser account-linking round-trip. Verified by verifyConnectState on the
 * /slack/connect callback.
 */
export async function signConnectState({ teamId, slackUserId }) {
  try {
    return await new SignJWT({ teamId, slackUserId, kind: "slack_connect" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("magicpen")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(stateSecret());
  } catch (err) {
    throw new Error(`Failed to sign Slack connect state: ${err.message}`, { cause: err });
  }
}

/**
 * Verifies a connect-state JWT and returns { teamId, slackUserId }, or null
 * for anything invalid/expired — callers treat null as "show an error page",
 * so this never throws.
 */
export async function verifyConnectState(token) {
  try {
    const { payload } = await jwtVerify(token, stateSecret(), { issuer: "magicpen" });
    if (payload.kind !== "slack_connect" || !payload.teamId || !payload.slackUserId) return null;
    return { teamId: payload.teamId, slackUserId: payload.slackUserId };
  } catch {
    return null;
  }
}

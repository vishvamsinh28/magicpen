import { createHmac, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

// Low-level Slack plumbing: request-signature verification, a tiny hand-rolled
// Web API client (no SDK dependency — same minimalist style as auth.js), the
// OAuth code exchange for public/multi-workspace installs, and signed "connect"
// state used by the browser account-linking flow. Nothing here touches the
// store; token lookup and business logic live in slack-actions.js.

/* ------------------------------- config ---------------------------------- */

export const slackConfigured = () =>
  !!(process.env.SLACK_SIGNING_SECRET && process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);

export const appBaseUrl = () => (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
export const slackRedirectUri = () => `${appBaseUrl()}/api/slack/oauth`;
export const connectUrl = (state) => `${appBaseUrl()}/slack/connect?state=${encodeURIComponent(state)}`;
export const docUrl = (documentId) => `${appBaseUrl()}/app?doc=${encodeURIComponent(documentId)}`;

// Scopes the bot needs; also used to build the install URL.
export const BOT_SCOPES = [
  "app_mentions:read",
  "chat:write",
  "im:history",
  "im:read",
  "im:write",
  "files:read",
  "commands",
  "users:read",
];

export const installUrl = () =>
  `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(process.env.SLACK_CLIENT_ID || "")}` +
  `&scope=${encodeURIComponent(BOT_SCOPES.join(","))}` +
  `&redirect_uri=${encodeURIComponent(slackRedirectUri())}`;

/* ------------------------- signature verification ------------------------- */

// Slack signs each request: v0=HMAC-SHA256(signingSecret, `v0:${ts}:${body}`).
// We must hash the RAW body, so callers read request.text() once and pass it in.
export function verifySlackSignature({ signature, timestamp, body }) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !signature || !timestamp) return false;

  // Replay protection: reject anything older than 5 minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const expected = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Reads the raw body once and verifies it. Returns { ok, body } so the caller
// can then parse `body` (JSON for events, urlencoded for commands/interactivity).
export async function readVerified(request) {
  const body = await request.text();
  const ok = verifySlackSignature({
    signature: request.headers.get("x-slack-signature"),
    timestamp: request.headers.get("x-slack-request-timestamp"),
    body,
  });
  return { ok, body };
}

/* ---------------------------- Web API client ------------------------------ */

export class SlackApiError extends Error {
  constructor(method, error, data) {
    super(`Slack ${method} failed: ${error}`);
    this.code = error;
    this.data = data;
  }
}

// Generic POST to https://slack.com/api/<method> with a bot token. Slack accepts
// JSON bodies for write methods. Throws SlackApiError when data.ok is false.
export async function slackApi(method, token, params = {}) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "invalid_json_response" }));
  if (!data.ok) throw new SlackApiError(method, data.error, data);
  return data;
}

export const postMessage = (token, params) => slackApi("chat.postMessage", token, params);
export const postEphemeral = (token, params) => slackApi("chat.postEphemeral", token, params);
export const getUserInfo = (token, user) => slackApi("users.info", token, { user });

// Download a Slack-hosted file (url_private) — needs the bot token as a bearer.
export async function downloadSlackFile(urlPrivate, token) {
  const res = await fetch(urlPrivate, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Slack file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ------------------------------- OAuth v2 --------------------------------- */

// Exchanges the install `code` for this workspace's bot token. Uses the
// urlencoded form Slack expects for oauth.v2.access.
export async function exchangeInstallCode(code) {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.SLACK_CLIENT_ID || "",
      client_secret: process.env.SLACK_CLIENT_SECRET || "",
      redirect_uri: slackRedirectUri(),
    }),
  });
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
// A short-lived signed token carrying the Slack identity through the browser
// account-linking round-trip. Signed with the Slack signing secret (always
// present when Slack is configured), so no extra secret to manage.

const stateSecret = () =>
  new TextEncoder().encode(process.env.SLACK_SIGNING_SECRET || "superdocs-slack-dev");

export async function signConnectState({ teamId, slackUserId }) {
  return new SignJWT({ teamId, slackUserId, kind: "slack_connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("superdocs")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(stateSecret());
}

export async function verifyConnectState(token) {
  try {
    const { payload } = await jwtVerify(token, stateSecret(), { issuer: "superdocs" });
    if (payload.kind !== "slack_connect" || !payload.teamId || !payload.slackUserId) return null;
    return { teamId: payload.teamId, slackUserId: payload.slackUserId };
  } catch {
    return null;
  }
}

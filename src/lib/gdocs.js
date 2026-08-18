import { timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

// Low-level plumbing for the Google Docs add-on — mirrors slack.js. The add-on
// itself is a separate Google Apps Script project (it can't be a Next.js route);
// this module is only the backend contract it talks to over HTTPS:
//   • verifyAddonSecret — a shared secret the add-on sends on every request, so
//     only our deployed add-on can reach these endpoints.
//   • signed "connect" state — carries the Google identity through the browser
//     account-linking round-trip, exactly like the Slack connect flow.
// Business logic (resolving the linked user, running the assistant) lives in
// gdocs-actions.js; nothing here touches the store.

/* ------------------------------- config ---------------------------------- */

export const gdocsConfigured = () => !!process.env.GDOCS_ADDON_SECRET;

export const appBaseUrl = () => (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
export const gdocsConnectUrl = (state) =>
  `${appBaseUrl()}/gdocs/connect?state=${encodeURIComponent(state)}`;

/* --------------------------- add-on request auth -------------------------- */

// Every add-on → backend request carries this shared secret in a header. The
// add-on keeps it in its Apps Script "Script Properties" (server-side, never in
// the sidebar HTML). Constant-time compare; false when the secret is unset so
// the endpoints stay closed until configured.
export function verifyAddonSecret(header) {
  const secret = process.env.GDOCS_ADDON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(String(header));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* --------------------------- connect-link state --------------------------- */
// A short-lived signed token carrying the Google identity through the browser
// account-linking round-trip. Signed with the add-on secret (always present
// when the add-on is configured), so there's no extra secret to manage.

const stateSecret = () =>
  new TextEncoder().encode(process.env.GDOCS_ADDON_SECRET || "magicpen-gdocs-dev");

export async function signConnectState({ googleUserId }) {
  return new SignJWT({ googleUserId, kind: "gdocs_connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("magicpen")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(stateSecret());
}

export async function verifyConnectState(token) {
  try {
    const { payload } = await jwtVerify(token, stateSecret(), { issuer: "magicpen" });
    if (payload.kind !== "gdocs_connect" || !payload.googleUserId) return null;
    return { googleUserId: payload.googleUserId };
  } catch {
    return null;
  }
}

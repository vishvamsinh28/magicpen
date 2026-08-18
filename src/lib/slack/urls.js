// App-facing URL builders shared by the Slack integration. All of them derive
// from APP_BASE_URL, so they only produce meaningful links once that env var is
// set (empty base → relative-looking URLs, which Slack would reject).

/**
 * Base URL of this deployment (APP_BASE_URL) with any trailing slashes
 * stripped, so callers can safely append `/path` segments.
 */
export const appBaseUrl = () => (process.env.APP_BASE_URL || "").replace(/\/+$/, "");

/**
 * OAuth redirect URI registered with the Slack app — must match the value in
 * the Slack app config byte-for-byte or the code exchange fails.
 */
export const slackRedirectUri = () => `${appBaseUrl()}/api/slack/oauth`;

/**
 * Browser URL for the one-time Slack↔MagicPen account-linking flow. `state` is
 * the signed JWT from signConnectState carrying the Slack identity.
 */
export const connectUrl = (state) => `${appBaseUrl()}/slack/connect?state=${encodeURIComponent(state)}`;

/**
 * Deep link that opens a document in the MagicPen web editor — used in every
 * "Open in MagicPen" link the bot posts.
 */
export const docUrl = (documentId) => `${appBaseUrl()}/app?doc=${encodeURIComponent(documentId)}`;

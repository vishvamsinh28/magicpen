import { Users, SlackInstalls, SlackLinks } from "@/lib/store";
import { connectUrl, signConnectState } from "@/lib/slack";
import { say, section, context } from "./format";

// Identity & tokens: which bot token serves a workspace, which MagicPen user a
// Slack user is linked to, and the connect prompt shown when they aren't.

/**
 * Bot token for a workspace. Prefers the per-workspace token from the OAuth
 * install; falls back to a single SLACK_BOT_TOKEN env var (handy for a
 * dev/single workspace). Null when neither exists.
 */
export const botTokenForTeam = async (teamId) =>
  (await SlackInstalls.getByTeam(teamId))?.botToken || process.env.SLACK_BOT_TOKEN || null;

/**
 * Resolves the MagicPen user linked to a Slack identity, or null when the
 * Slack user hasn't connected an account yet (callers then prompt to connect).
 */
export async function resolveUser(teamId, slackUserId) {
  const link = await SlackLinks.get(teamId, slackUserId);
  if (!link?.userId) return null;
  return Users.get(link.userId);
}

/**
 * Block Kit payload inviting the user to link their MagicPen account. `url` is
 * a signed connect URL from signConnectState + connectUrl.
 */
export function connectPayload(url) {
  return {
    text: "Connect your MagicPen account to continue.",
    blocks: [
      section("👋 *Connect your MagicPen account* to let me create, edit, and manage your documents from Slack."),
      section(`<${url}|Connect MagicPen →>`),
      context("You only do this once. It links your Slack identity to your MagicPen account."),
    ],
  };
}

/**
 * Posts the connect invitation into a channel/thread — used when an unlinked
 * user messages the bot directly.
 */
export async function promptConnect({ botToken, channel, threadTs, teamId, slackUserId }) {
  const state = await signConnectState({ teamId, slackUserId });
  await say(botToken, { channel, threadTs, ...connectPayload(connectUrl(state)) });
}

import { store } from "./backend";
import { now, newId } from "./ids";

/**
 * Slack and Google Docs integration collections: workspace installs, identity
 * links between external accounts and MagicPen users, thread bindings, and
 * the Slack event-delivery guards.
 */

/**
 * One row per workspace that installed the Slack app. Public distribution
 * means each install mints its own bot token, so inbound events look the
 * token up by the team id carried in the payload. Keyed (and uniquely
 * indexed) on teamId.
 */
export const SlackInstalls = {
  getByTeam: (teamId) => store().findOne("slackinstalls", { teamId }),
  save: ({ teamId, teamName = null, botToken, botUserId = null, appId = null, authedUserId = null }) =>
    store().upsert(
      "slackinstalls",
      { teamId },
      { teamName, botToken, botUserId, appId, authedUserId, updatedAt: now() }
    ),
  remove: (teamId) => store().removeWhere("slackinstalls", { teamId }),
};

/**
 * Maps a Slack identity (team + user) to a MagicPen account so the bot can act
 * as that user. Written by the browser connect flow, which proves the MagicPen
 * session before linking. Keyed (and uniquely indexed) on (teamId, slackUserId).
 */
export const SlackLinks = {
  get: (teamId, slackUserId) => store().findOne("slacklinks", { teamId, slackUserId }),
  link: ({ teamId, slackUserId, userId }) =>
    store().upsert("slacklinks", { teamId, slackUserId }, { userId, updatedAt: now() }),
  unlink: (teamId, slackUserId) => store().removeWhere("slacklinks", { teamId, slackUserId }),
};

/**
 * Maps a Google identity (the add-on user's email) to a MagicPen account so
 * the Docs add-on can act as that user. Written by the browser connect flow,
 * which proves the MagicPen session before linking — the same pattern as
 * SlackLinks. Keyed (and uniquely indexed) on googleUserId.
 */
export const GoogleLinks = {
  get: (googleUserId) => store().findOne("googlelinks", { googleUserId }),
  link: ({ googleUserId, userId }) =>
    store().upsert("googlelinks", { googleUserId }, { userId, updatedAt: now() }),
  unlink: (googleUserId) => store().removeWhere("googlelinks", { googleUserId }),
};

/**
 * Binds a Slack conversation thread to a MagicPen document + chat so follow-up
 * messages in the same thread keep operating on the same document. Keyed (and
 * uniquely indexed) on (teamId, channelId, threadTs).
 */
export const SlackThreads = {
  get: (teamId, channelId, threadTs) =>
    store().findOne("slackthreads", { teamId, channelId, threadTs }),
  bind: ({ teamId, channelId, threadTs, userId, documentId, chatId }) =>
    store().upsert(
      "slackthreads",
      { teamId, channelId, threadTs },
      { userId, documentId, chatId, updatedAt: now() }
    ),
};

/**
 * Temporary observability for wiring up the Slack integration: every inbound
 * request and handler outcome is appended here so failures (events not
 * arriving, signature mismatch, missing token, Slack API errors) are visible
 * without server log access. Safe to remove once the bot is working.
 */
export const SlackDebug = {
  log: (record) => store().insert("slackdebug", { id: newId(), ...record, createdAt: now() }),
  recent: (n = 30) => store().find("slackdebug", {}, { sort: ["createdAt", -1], limit: n }),
};

/**
 * Idempotency guard: Slack re-delivers events on timeout/retry, and the bot
 * mutates documents, so each event must be handled at most once. claim() wins
 * exactly once per eventId (the _id unique constraint is atomic in Mongo);
 * release() lets a genuinely-failed handler be retried.
 */
export const SlackEvents = {
  claim: async (eventId) => {
    try {
      await store().insert("slackevents", { id: eventId, createdAt: now() });
      return true;
    } catch {
      // Duplicate _id — this delivery was already claimed by another request.
      // (A connection failure also lands here; returning false just defers the
      // event to Slack's retry, which is the safe direction for idempotency.)
      return false;
    }
  },
  release: (eventId) => store().removeWhere("slackevents", { id: eventId }),
};

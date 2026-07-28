import { after } from "next/server";
import { verifySlackSignature } from "@/lib/slack";
import { handleMessage, botTokenForTeam } from "@/lib/slack-actions";
import { SlackDebug, SlackEvents } from "@/lib/store";

// Slack Events API webhook: URL verification handshake + inbound app_mention /
// message.im events. We verify the signature, ack within Slack's 3s window, and
// do the (slower, AI-backed) work in after() so the response isn't blocked.
//
// Every request and handler outcome is written to SlackDebug so integration
// problems are visible without server log access (temporary; safe to remove).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ok = () => new Response(null, { status: 200 });

// Only genuine user messages should be processed — never the bot's own posts,
// edits, deletions, joins, etc. File shares (subtype "file_share") are allowed.
function isActionableMessage(event) {
  if (!event) return false;
  if (event.bot_id) return false;
  if (event.type === "app_mention") return true;
  if (event.type === "message" && event.channel_type === "im") {
    return !event.subtype || event.subtype === "file_share";
  }
  return false;
}

export async function POST(request) {
  const body = await request.text();
  const sigHeader = request.headers.get("x-slack-signature");
  const tsHeader = request.headers.get("x-slack-request-timestamp");
  const verified = verifySlackSignature({ signature: sigHeader, timestamp: tsHeader, body });

  let payload = null;
  try { payload = JSON.parse(body); } catch {}

  // Observability: record that a request arrived and how it looked.
  await SlackDebug.log({
    kind: "events_inbound",
    hasSig: !!sigHeader,
    hasTs: !!tsHeader,
    signatureValid: verified,
    signingSecretSet: !!process.env.SLACK_SIGNING_SECRET,
    payloadType: payload?.type || null,
    eventType: payload?.event?.type || null,
    subtype: payload?.event?.subtype || null,
    channelType: payload?.event?.channel_type || null,
    teamId: payload?.team_id || payload?.event?.team || null,
    slackUserId: payload?.event?.user || null,
    retryNum: request.headers.get("x-slack-retry-num") || null,
  }).catch(() => {});

  if (!verified) return new Response("bad signature", { status: 401 });

  if (payload?.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload?.type !== "event_callback" || !isActionableMessage(payload.event)) {
    return ok();
  }

  const event = payload.event;
  const teamId = payload.team_id || event.team;
  const eventId = payload.event_id;

  after(async () => {
    // Idempotency: Slack re-delivers on timeout/retry and the bot mutates docs,
    // so handle each event once. A failed handler releases the claim so a
    // genuine retry can re-process.
    if (eventId && !(await SlackEvents.claim(eventId))) {
      await SlackDebug.log({ kind: "handle", stage: "duplicate_skipped", teamId }).catch(() => {});
      return;
    }
    try {
      const botToken = await botTokenForTeam(teamId);
      await SlackDebug.log({ kind: "handle", stage: "start", teamId, hasToken: !!botToken, eventType: event.type }).catch(() => {});
      if (!botToken) return;
      await handleMessage({
        teamId,
        channel: event.channel,
        slackUserId: event.user,
        text: event.text || "",
        threadTs: event.thread_ts || event.ts,
        files: event.files || [],
        botToken,
      });
      await SlackDebug.log({ kind: "handle", stage: "done", teamId }).catch(() => {});
    } catch (err) {
      if (eventId) await SlackEvents.release(eventId).catch(() => {});
      await SlackDebug.log({
        kind: "handle", stage: "error", teamId,
        error: String(err?.message || err), code: err?.code || null,
        slackError: err?.data?.error || null,
      }).catch(() => {});
      console.error("[superdocs/slack] event handler failed:", err);
    }
  });

  return ok();
}

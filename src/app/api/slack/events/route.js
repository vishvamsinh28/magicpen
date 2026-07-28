import { after } from "next/server";
import { readVerified } from "@/lib/slack";
import { handleMessage, botTokenForTeam } from "@/lib/slack-actions";

// Slack Events API webhook: URL verification handshake + inbound app_mention /
// message.im events. We verify the signature, ack within Slack's 3s window, and
// do the (slower, AI-backed) work in after() so the response isn't blocked.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ok = () => new Response(null, { status: 200 });

// Only genuine user messages should be processed — never the bot's own posts,
// edits, deletions, joins, etc. File shares (subtype "file_share") are allowed.
function isActionableMessage(event) {
  if (event.bot_id) return false;
  if (event.type === "app_mention") return true;
  if (event.type === "message" && event.channel_type === "im") {
    return !event.subtype || event.subtype === "file_share";
  }
  return false;
}

export async function POST(request) {
  const { ok: verified, body } = await readVerified(request);
  if (!verified) return new Response("bad signature", { status: 401 });

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Endpoint verification handshake (done once when you set the Request URL).
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback" || !isActionableMessage(payload.event)) {
    return ok();
  }

  const event = payload.event;
  const teamId = payload.team_id || event.team;

  // Ack immediately; process in the background so Slack doesn't retry.
  after(async () => {
    try {
      const botToken = await botTokenForTeam(teamId);
      if (!botToken) {
        console.error("[superdocs/slack] no install/token for team", teamId);
        return;
      }
      await handleMessage({
        teamId,
        channel: event.channel,
        slackUserId: event.user,
        text: event.text || "",
        threadTs: event.thread_ts || event.ts,
        files: event.files || [],
        botToken,
      });
    } catch (err) {
      console.error("[superdocs/slack] event handler failed:", err);
    }
  });

  return ok();
}

import { after } from "next/server";
import { readVerified } from "@/lib/slack";
import { handleButton, botTokenForTeam } from "@/lib/slack-actions";

// Interactivity webhook: Block Kit button clicks (Commit / Undo). The payload
// arrives urlencoded as a `payload` field. We verify, ack immediately, and run
// the action in after().

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const { ok: verified, body } = await readVerified(request);
  if (!verified) return new Response("bad signature", { status: 401 });

  let payload;
  try {
    payload = JSON.parse(new URLSearchParams(body).get("payload"));
  } catch {
    return new Response("bad payload", { status: 400 });
  }

  if (payload.type !== "block_actions" || !payload.actions?.length) {
    return new Response(null, { status: 200 });
  }

  const teamId = payload.team?.id;
  const action = payload.actions[0];
  const message = payload.message || {};

  after(async () => {
    try {
      const botToken = await botTokenForTeam(teamId);
      if (!botToken) return;
      await handleButton({
        teamId,
        slackUserId: payload.user?.id,
        channel: payload.channel?.id,
        threadTs: message.thread_ts || message.ts,
        botToken,
        actionId: action.action_id,
        value: action.value,
      });
    } catch (err) {
      console.error("[superdocs/slack] interactivity handler failed:", err);
    }
  });

  return new Response(null, { status: 200 });
}

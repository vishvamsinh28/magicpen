import { after } from "next/server";
import { readVerified } from "@/lib/slack";
import { handleSlashCommand, createDocFromSlash, botTokenForTeam } from "@/lib/slack-actions";

// Slash command webhook for `/superdoc …`. Fast, DB-only subcommands answer
// inline. `new` runs the AI and posts a document thread, so it acks immediately
// and does its work in after() (staying inside Slack's 3s ack window).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ephemeral = (payload) => Response.json({ response_type: "ephemeral", ...payload });

export async function POST(request) {
  const { ok, body } = await readVerified(request);
  if (!ok) return new Response("bad signature", { status: 401 });

  const form = new URLSearchParams(body);
  const teamId = form.get("team_id");
  const slackUserId = form.get("user_id");
  const channel = form.get("channel_id");
  const text = form.get("text") || "";
  const responseUrl = form.get("response_url");
  const sub = text.trim().split(/\s+/)[0];

  // Slow path: create a document + post it as a thread.
  if (sub === "new") {
    const prompt = text.trim().replace(/^new\s*/i, "");
    after(async () => {
      try {
        const botToken = await botTokenForTeam(teamId);
        if (!botToken) {
          await fetch(responseUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ response_type: "ephemeral", text: "The bot isn't fully installed yet — no bot token for this workspace." }),
          }).catch(() => {});
          return;
        }
        await createDocFromSlash({ teamId, channel, slackUserId, prompt, botToken, responseUrl });
      } catch (err) {
        console.error("[superdocs/slack] slash 'new' failed:", err);
      }
    });
    return ephemeral({ text: "✍️ Drafting your document…" });
  }

  // Fast path: compute and return directly.
  try {
    const result = await handleSlashCommand({ teamId, slackUserId, text });
    return ephemeral(result);
  } catch (err) {
    console.error("[superdocs/slack] slash command failed:", err);
    return ephemeral({ text: "Something went wrong running that command." });
  }
}

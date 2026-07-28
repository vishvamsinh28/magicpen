import { after } from "next/server";
import { readVerified } from "@/lib/slack";
import { handleSlashCommand } from "@/lib/slack-actions";

// Slash command webhook for `/superdoc …`. Fast, DB-only subcommands answer
// inline; `new` runs the AI, so it acks immediately and posts the result to the
// command's response_url when ready (staying inside Slack's 3s ack window).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ephemeral = (payload) => Response.json({ response_type: "ephemeral", ...payload });

export async function POST(request) {
  const { ok, body } = await readVerified(request);
  if (!ok) return new Response("bad signature", { status: 401 });

  const form = new URLSearchParams(body);
  const args = {
    teamId: form.get("team_id"),
    slackUserId: form.get("user_id"),
    channel: form.get("channel_id"),
    text: form.get("text") || "",
  };
  const responseUrl = form.get("response_url");
  const sub = args.text.trim().split(/\s+/)[0];

  // Slow path (AI): ack now, deliver via response_url.
  if (sub === "new") {
    after(async () => {
      try {
        const result = await handleSlashCommand(args);
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response_type: "ephemeral", ...result }),
        });
      } catch (err) {
        console.error("[superdocs/slack] slash 'new' failed:", err);
      }
    });
    return ephemeral({ text: "✍️ Drafting your document…" });
  }

  // Fast path: compute and return directly.
  try {
    const result = await handleSlashCommand(args);
    return ephemeral(result);
  } catch (err) {
    console.error("[superdocs/slack] slash command failed:", err);
    return ephemeral({ text: "Something went wrong running that command." });
  }
}

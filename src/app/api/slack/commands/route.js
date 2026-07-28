import { after } from "next/server";
import { readVerified } from "@/lib/slack";
import { handleSlashCommand, createDocFromSlash, openDocFromSlash, clearConversation, botTokenForTeam } from "@/lib/slack-actions";

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
  const sub = (text.trim().split(/\s+/)[0] || "").toLowerCase();

  const notInstalled = () =>
    fetch(responseUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_type: "ephemeral", text: "The bot isn't fully installed yet — no bot token for this workspace." }),
    }).catch(() => {});

  // Create a new, empty document (named by the user) + post it as a thread.
  if (sub === "new") {
    const name = text.trim().replace(/^new\s*/i, "");
    after(async () => {
      try {
        const botToken = await botTokenForTeam(teamId);
        if (!botToken) { await notInstalled(); return; }
        await createDocFromSlash({ teamId, channel, slackUserId, name, botToken, responseUrl });
      } catch (err) {
        console.error("[superdocs/slack] slash 'new' failed:", err);
      }
    });
    return ephemeral({ text: "📄 Creating your document…" });
  }

  // Open an existing document as a working thread.
  if (sub === "open") {
    const query = text.trim().replace(/^open\s*/i, "");
    after(async () => {
      try {
        const botToken = await botTokenForTeam(teamId);
        if (!botToken) { await notInstalled(); return; }
        await openDocFromSlash({ teamId, channel, slackUserId, query, botToken, responseUrl });
      } catch (err) {
        console.error("[superdocs/slack] slash 'open' failed:", err);
      }
    });
    return ephemeral({ text: "📂 Opening…" });
  }

  // Slow path: delete the bot's messages/files in this conversation.
  if (sub === "clear") {
    after(async () => {
      try {
        const botToken = await botTokenForTeam(teamId);
        if (!botToken) { await notInstalled(); return; }
        await clearConversation({ teamId, channel, botToken, responseUrl });
      } catch (err) {
        console.error("[superdocs/slack] slash 'clear' failed:", err);
      }
    });
    return ephemeral({ text: "🧹 Clearing my messages…" });
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

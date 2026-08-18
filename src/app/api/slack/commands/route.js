import { after } from "next/server";
import { readVerified } from "@/lib/slack";
import { handleSlashCommand, createDocFromSlash, openDocFromSlash, clearConversation, botTokenForTeam } from "@/lib/slack-actions";

// Slash command webhook for `/magicpen …`. Fast, DB-only subcommands answer
// inline. `new` runs the AI and posts a document thread, so it acks immediately
// and does its work in after() (staying inside Slack's 3s ack window).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ephemeral = (payload) => Response.json({ response_type: "ephemeral", ...payload });

/**
 * POST /api/slack/commands — handle `/magicpen` slash commands.
 * `new`/`open`/`clear` ack instantly and finish in after(); everything else
 * runs inline. All replies are ephemeral so channels stay clean.
 */
export async function POST(request) {
  let verified;
  try {
    verified = await readVerified(request);
  } catch (err) {
    console.error("[magicpen/slack] slash payload read failed:", err);
    return new Response("internal error", { status: 500 });
  }
  if (!verified.ok) return new Response("bad signature", { status: 401 });

  const form = new URLSearchParams(verified.body);
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

  // Slow subcommands share one shape: ack now, do the work in after(), and
  // report failures through the response_url (never by holding the ack).
  const ackAndRun = (ackText, label, work) => {
    after(async () => {
      try {
        const botToken = await botTokenForTeam(teamId);
        if (!botToken) { await notInstalled(); return; }
        await work(botToken);
      } catch (err) {
        console.error(`[magicpen/slack] slash '${label}' failed:`, err);
      }
    });
    return ephemeral({ text: ackText });
  };

  // Create a new, empty document (named by the user) + post it as a thread.
  if (sub === "new") {
    const name = text.trim().replace(/^new\s*/i, "");
    return ackAndRun("📄 Creating your document…", "new", (botToken) =>
      createDocFromSlash({ teamId, channel, slackUserId, name, botToken, responseUrl })
    );
  }

  // Open an existing document as a working thread.
  if (sub === "open") {
    const query = text.trim().replace(/^open\s*/i, "");
    return ackAndRun("📂 Opening…", "open", (botToken) =>
      openDocFromSlash({ teamId, channel, slackUserId, query, botToken, responseUrl })
    );
  }

  // Slow path: delete the bot's messages/files in this conversation.
  if (sub === "clear") {
    return ackAndRun("🧹 Clearing my messages…", "clear", (botToken) =>
      clearConversation({ teamId, channel, botToken, responseUrl })
    );
  }

  // Fast path: compute and return directly.
  try {
    const result = await handleSlashCommand({ teamId, slackUserId, text });
    return ephemeral(result);
  } catch (err) {
    console.error("[magicpen/slack] slash command failed:", err);
    return ephemeral({ text: "Something went wrong running that command." });
  }
}

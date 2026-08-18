import { SlackInstalls } from "@/lib/store";
import { authTest, conversationsHistory, conversationsReplies, deleteMessage, deleteFile } from "@/lib/slack";
import { postToResponseUrl } from "./format";

// `/magicpen clear` — deletes the bot's own messages (and files it posted) in
// the conversation where the command was run. Slack won't let a user delete a
// bot's messages, so the bot does it. Only messages authored by THIS bot user
// are touched — human and other-app messages are left alone.

// Safety valves: cap pagination so a giant conversation can't run forever; the
// ephemeral reply tells the user to re-run the command for the rest.
const MAX_PAGES = 10;

// Walks one thread's replies (paginated) and feeds each to `collect`, skipping
// the parent (`parentTs`) — the history walk collects parents itself.
async function collectThreadReplies({ botToken, channel, threadTs, parentTs, collect }) {
  let cursor;
  let pages = 0;
  do {
    const rep = await conversationsReplies(botToken, { channel, ts: threadTs, cursor, limit: 200 });
    for (const rm of rep.messages || []) {
      if (rm.ts === parentTs) continue; // parent is collected by the caller
      collect(rm);
    }
    cursor = rep.response_metadata?.next_cursor;
    pages++;
  } while (cursor && pages < MAX_PAGES);
}

// Walks the conversation's history (paginated) and feeds every message to
// `collect`. The bot mostly posts as thread replies, which history never
// returns — so each threaded message's replies are walked too.
async function collectBotMessages({ botToken, channel, collect }) {
  let cursor;
  let pages = 0;
  do {
    const hist = await conversationsHistory(botToken, { channel, cursor, limit: 200 });
    for (const m of hist.messages || []) {
      if (m.reply_count > 0 || (m.thread_ts && m.thread_ts === m.ts)) {
        await collectThreadReplies({ botToken, channel, threadTs: m.thread_ts || m.ts, parentTs: m.ts, collect });
      }
      collect(m); // the top-level message itself
    }
    cursor = hist.response_metadata?.next_cursor;
    pages++;
  } while (cursor && pages < MAX_PAGES);
}

/**
 * Collects and deletes this bot's messages + files in a conversation,
 * including thread replies (history returns only parents, so each thread is
 * walked). Reports progress through the slash command's response_url; stops
 * early and says so when Slack rate-limits the deletes.
 */
export async function clearConversation({ teamId, channel, botToken, responseUrl }) {
  let botUserId = (await SlackInstalls.getByTeam(teamId))?.botUserId;
  if (!botUserId) {
    try {
      botUserId = (await authTest(botToken)).user_id;
    } catch (err) {
      // Fall through to the "couldn't identify" reply below.
      console.error("[magicpen/slack] clear: auth.test failed:", err);
    }
  }
  if (!botUserId) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: "Couldn't identify the bot to clear its messages. Make sure the app is installed." });
    return;
  }

  const messageTs = [];
  const fileIds = new Set();
  const collect = (m) => {
    if (m.user !== botUserId) return; // only this bot's own messages
    messageTs.push(m.ts);
    for (const f of m.files || []) if (f.id) fileIds.add(f.id);
  };

  try {
    await collectBotMessages({ botToken, channel, collect });
  } catch (err) {
    console.error("[magicpen/slack] clear: history read failed:", err);
    const hint = err.code === "missing_scope" ? " (the bot needs history access for this conversation)" : "";
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `Couldn't read this conversation${hint}.` });
    return;
  }

  let deletedMsgs = 0;
  let rateLimited = false;
  for (const ts of messageTs) {
    try {
      await deleteMessage(botToken, channel, ts);
      deletedMsgs++;
    } catch (err) {
      if (err.code === "ratelimited") { rateLimited = true; break; }
      // message_not_found / cant_delete_message — skip and continue
    }
  }

  let deletedFiles = 0;
  for (const id of fileIds) {
    try {
      await deleteFile(botToken, id);
      deletedFiles++;
    } catch (err) {
      // Already-deleted or undeletable file — skip it, keep clearing the rest.
      console.error("[magicpen/slack] clear: file delete failed:", err.code || err.message);
    }
  }

  const filePart = deletedFiles ? ` and ${deletedFiles} file${deletedFiles === 1 ? "" : "s"}` : "";
  const morePart = rateLimited ? " — hit Slack's rate limit, run `/magicpen clear` again for the rest" : "";
  await postToResponseUrl(responseUrl, {
    response_type: "ephemeral",
    text: `🧹 Cleared ${deletedMsgs} message${deletedMsgs === 1 ? "" : "s"}${filePart}${morePart}.`,
  });
}

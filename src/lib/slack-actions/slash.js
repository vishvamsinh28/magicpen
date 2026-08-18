import { Documents, Chats, SlackThreads } from "@/lib/store";
import { postMessage, connectUrl, signConnectState } from "@/lib/slack";
import { section, context, openLink, deSlackEscape, normalizeForMatch, postToResponseUrl } from "./format";
import { resolveUser, connectPayload } from "./identity";
import { deliverFile } from "./doc-ops";

// The two slash subcommands that post a document thread: `/magicpen new` and
// `/magicpen open`. Both run in the route's after() — replies go through the
// command's response_url, not a direct response.

/**
 * `/magicpen new <name>` — creates a new, EMPTY document titled exactly what
 * the user typed, posts it as a thread, and binds the thread. Content is added
 * later by replying in the thread; no AI runs at creation time.
 */
export async function createDocFromSlash({ teamId, channel, slackUserId, name, botToken, responseUrl }) {
  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", ...connectPayload(connectUrl(state)) });
    return;
  }

  const title = (deSlackEscape(name).trim() || "Untitled document").slice(0, 200);
  const doc = await Documents.create({ userId: user.id, title, contentHtml: "" });
  const chat = await Chats.create({ userId: user.id, title: title.slice(0, 64), scope: "document", documentId: doc.id });

  try {
    const posted = await postMessage(botToken, {
      channel,
      text: `📄 Created *${title}*`,
      blocks: [
        section(`📄 Created *${title}* — a new, empty document.`),
        context('Reply in this thread to add content — e.g. _"write a resume for a backend engineer"_. Actions: `:send:` for the file · `:commit:` to snapshot · `:undo:` to revert.'),
        section(openLink(doc.id)),
      ],
      unfurl_links: false,
    });
    await SlackThreads.bind({ teamId, channelId: channel, threadTs: posted.ts, userId: user.id, documentId: doc.id, chatId: chat.id });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `✅ Created *${title}* — reply in the thread I posted to add content.` });
  } catch (err) {
    console.error("[magicpen/slack] create post failed:", err);
    await postToResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `✅ Created *${title}*, but I couldn't post it here (${err.code || "error"}). ${openLink(doc.id)}`,
    });
  }
}

/**
 * `/magicpen open <title>` — opens an EXISTING document as a working thread:
 * finds it by (forgiving) title match, posts a thread root, binds the thread +
 * a fresh chat, and delivers the file — so the user can immediately reply to
 * ask or edit it.
 */
export async function openDocFromSlash({ teamId, channel, slackUserId, query, botToken, responseUrl }) {
  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", ...connectPayload(connectUrl(state)) });
    return;
  }

  const q = deSlackEscape(query).trim();
  if (!q) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: "Usage: `/magicpen open <title>`" });
    return;
  }

  const docs = await Documents.list(user.id);
  const nq = normalizeForMatch(q);
  // Prefer an exact (normalized) title, else the first that contains the query.
  const doc =
    (nq && docs.find((d) => normalizeForMatch(d.title) === nq)) ||
    (nq && docs.find((d) => normalizeForMatch(d.title).includes(nq)));
  if (!doc) {
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `No document matching *${q}*. Try \`/magicpen list\`.` });
    return;
  }

  const chat = await Chats.create({ userId: user.id, title: doc.title.slice(0, 64), scope: "document", documentId: doc.id });
  try {
    const posted = await postMessage(botToken, {
      channel,
      text: `📄 Opened *${doc.title}*`,
      blocks: [
        section(`📄 Opened *${doc.title}*`),
        context('Reply in this thread to work with it — e.g. _"what\'s in this doc?"_ or _"add a deadline section"_. Actions: `:send:` · `:commit:` · `:undo:`.'),
        section(openLink(doc.id)),
      ],
      unfurl_links: false,
    });
    await SlackThreads.bind({ teamId, channelId: channel, threadTs: posted.ts, userId: user.id, documentId: doc.id, chatId: chat.id });
    await deliverFile({ botToken, channel, threadTs: posted.ts, doc, comment: `📎 Here's *${doc.title}*.` });
    await postToResponseUrl(responseUrl, { response_type: "ephemeral", text: `✅ Opened *${doc.title}* — reply in the thread I posted to work with it.` });
  } catch (err) {
    console.error("[magicpen/slack] open post failed:", err);
    await postToResponseUrl(responseUrl, {
      response_type: "ephemeral",
      text: `Found *${doc.title}* but couldn't post it here (${err.code || "error"}). ${openLink(doc.id)}`,
    });
  }
}

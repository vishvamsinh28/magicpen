// Tiny hand-rolled Slack Web API client (no SDK dependency — same minimalist
// style as auth.js). Write methods POST JSON; read methods POST urlencoded
// forms (the read endpoints are happiest that way). Every helper throws
// SlackApiError when Slack answers ok:false, so callers can branch on err.code
// (e.g. "missing_scope", "ratelimited").

/**
 * Error thrown when a Slack Web API call returns ok:false. `code` carries
 * Slack's error string (callers branch on it) and `data` the full payload.
 */
export class SlackApiError extends Error {
  constructor(method, error, data) {
    super(`Slack ${method} failed: ${error}`);
    this.code = error;
    this.data = data;
  }
}

// Shared response handling: tolerate a non-JSON body (surfaced as the
// "invalid_json_response" code) and convert ok:false into SlackApiError.
async function readSlackResponse(method, res) {
  const data = await res.json().catch(() => ({ ok: false, error: "invalid_json_response" }));
  if (!data.ok) throw new SlackApiError(method, data.error, data);
  return data;
}

/**
 * Generic POST to https://slack.com/api/<method> with a JSON body and a bot
 * token. Throws SlackApiError on ok:false, or a context-wrapped Error when the
 * network request itself fails.
 */
export async function slackApi(method, token, params = {}) {
  let res;
  try {
    res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new Error(`Slack ${method} request failed: ${err.message}`, { cause: err });
  }
  return readSlackResponse(method, res);
}

// Same as slackApi but with an application/x-www-form-urlencoded body
// (URLSearchParams) — required by the conversation-read and upload-URL methods.
async function slackFormApi(method, token, params) {
  let res;
  try {
    res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Bearer ${token}` },
      body: params,
    });
  } catch (err) {
    throw new Error(`Slack ${method} request failed: ${err.message}`, { cause: err });
  }
  return readSlackResponse(method, res);
}

/** Posts a message (chat.postMessage). `params` is Slack's own payload shape. */
export const postMessage = (token, params) => slackApi("chat.postMessage", token, params);

/** Identity of the token's bot user (used to find the bot's own messages). */
export const authTest = (token) => slackApi("auth.test", token, {});

/** Deletes one of the bot's own messages (chat.delete). */
export const deleteMessage = (token, channel, ts) => slackApi("chat.delete", token, { channel, ts });

/** Deletes a file the bot uploaded (files.delete). */
export const deleteFile = (token, file) => slackApi("files.delete", token, { file });

/**
 * Reads a page of a conversation's message history. Thread replies are NOT
 * included — history returns only parents; walk threads via
 * conversationsReplies.
 */
export function conversationsHistory(token, { channel, cursor, limit = 200 }) {
  const params = new URLSearchParams({ channel, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return slackFormApi("conversations.history", token, params);
}

/** Reads a page of one thread's replies (parent message included by Slack). */
export function conversationsReplies(token, { channel, ts, cursor, limit = 200 }) {
  const params = new URLSearchParams({ channel, ts, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return slackFormApi("conversations.replies", token, params);
}

/**
 * Downloads a Slack-hosted file (a url_private/url_private_download URL) —
 * requires the bot token as a bearer. Resolves to a Buffer of the raw bytes.
 */
export async function downloadSlackFile(urlPrivate, token) {
  try {
    const res = await fetch(urlPrivate, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Slack file download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (/^Slack file download failed/.test(err.message)) throw err;
    throw new Error(`Slack file download failed: ${err.message}`, { cause: err });
  }
}

/**
 * Uploads a file into a channel/thread using Slack's current 3-step external
 * upload flow (files.upload is deprecated). Requires the files:write scope.
 * `comment` becomes the message text that carries the file.
 */
export async function uploadFileToSlack(token, { channel, threadTs, filename, buffer, title, comment }) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // 1) reserve an upload URL
  const getData = await slackFormApi(
    "files.getUploadURLExternal",
    token,
    new URLSearchParams({ filename, length: String(bytes.length) })
  );

  // 2) send the bytes to the reserved URL (Slack accepts POST here)
  let putRes;
  try {
    putRes = await fetch(getData.upload_url, { method: "POST", body: bytes });
  } catch (err) {
    throw new Error(`Slack file bytes upload failed: ${err.message}`, { cause: err });
  }
  if (!putRes.ok) throw new Error(`Slack file bytes upload failed: ${putRes.status}`);

  // 3) finalize + share into the channel/thread
  const params = { files: [{ id: getData.file_id, title: title || filename }] };
  if (channel) params.channel_id = channel;
  if (threadTs) params.thread_ts = threadTs;
  if (comment) params.initial_comment = comment;
  return slackApi("files.completeUploadExternal", token, params);
}

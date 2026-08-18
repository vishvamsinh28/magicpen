import { postMessage, docUrl } from "@/lib/slack";

// Shared text/Block Kit helpers for the Slack bot. Everything here is pure
// formatting or thin delivery plumbing — no store access, no business logic.

/**
 * Strips Slack's message markup (<@mentions>, <url|label> links, <url>
 * wrappers) and collapses whitespace, leaving the human-typed text.
 */
export function unwrapSlackText(text = "") {
  return String(text)
    .replace(/<@[^>]+>/g, "")
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Undoes Slack's backslash-escaping of markdown chars (\_ \* \~) in
 * slash-command text — a typed title like verification_letter_… arrives as
 * verification\_letter\_….
 */
export const deSlackEscape = (s) => String(s || "").replace(/\\([_*~`>|])/g, "$1");

/**
 * Collapses a string to lowercase alphanumerics for forgiving title matching —
 * underscores, dashes, spaces, and Slack's escaping all become irrelevant.
 */
export const normalizeForMatch = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Compact "YYYY-MM-DD HH:MM" timestamp used in default version labels. */
export const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

/**
 * Maps an assistant error to the message shown in the thread. Branches on the
 * error codes runAssistant throws (ai_not_configured / ai_quota).
 */
export function aiErrorText(err) {
  if (err.code === "ai_not_configured") return "The AI isn't configured on the server yet (missing GEMINI_API_KEY).";
  if (err.code === "ai_quota") return err.message;
  return "The AI request failed — please try again.";
}

const FORMAT_ALIAS = { markdown: "md", text: "txt" };
// Picks an export format out of free text ("md please" → "md"); docx default.
const parseFmt = (s) => {
  const raw = (String(s || "").match(/\b(docx|md|markdown|txt|text|html)\b/i) || [])[1];
  return raw ? (FORMAT_ALIAS[raw.toLowerCase()] || raw.toLowerCase()) : "docx";
};

/**
 * Parses an in-thread message into an action. Actions are colon-tokens ONLY
 * (:commit: :send: :undo: :rename: :delete:), so a natural message can never
 * be mistaken for a command — anything without a leading token is an
 * edit/question ({ action: "edit" }).
 */
export function parseThreadCommand(text) {
  const token = text.trim().match(/^:(commit|send|undo|rename|delete):\s*([\s\S]*)$/i);
  if (!token) return { action: "edit" };
  const action = token[1].toLowerCase();
  const rest = token[2].trim();
  if (action === "send") return { action: "send", format: parseFmt(rest) };
  if (action === "commit") return { action: "commit", arg: rest };
  if (action === "rename") return { action: "rename", arg: rest };
  if (action === "delete") return { action: "delete", arg: rest };
  return { action: "undo" };
}

/* ------------------------------ block helpers ----------------------------- */

/** Block Kit mrkdwn section block. */
export const section = (text) => ({ type: "section", text: { type: "mrkdwn", text } });

/** Block Kit context block (the small grey helper line). */
export const context = (text) => ({ type: "context", elements: [{ type: "mrkdwn", text }] });

/**
 * Plain "Open in MagicPen" hyperlink (no button element) so nothing depends on
 * Slack Interactivity being configured.
 */
export const openLink = (documentId) => `<${docUrl(documentId)}|Open in MagicPen>`;

/** Posts into a channel/thread with link unfurling off — the bot's one voice. */
export const say = (botToken, { channel, threadTs, text, blocks }) =>
  postMessage(botToken, { channel, thread_ts: threadTs, text, blocks, unfurl_links: false });

/**
 * Posts a payload to a slash command's response_url. Best-effort by design:
 * the response_url expires after 30 minutes and the user-visible work has
 * already happened, so failures are logged, never thrown.
 */
export async function postToResponseUrl(url, payload) {
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[magicpen/slack] response_url post failed:", err);
  });
}

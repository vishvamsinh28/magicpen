import { createHmac, timingSafeEqual } from "crypto";

// Slack request-signature verification. This is a wire contract: Slack signs
// v0=HMAC-SHA256(signingSecret, `v0:${ts}:${body}`) over the RAW request body,
// so callers must read request.text() exactly once and pass that string in.

/**
 * Verifies a Slack request signature (constant-time compare) with replay
 * protection: requests older than 5 minutes are rejected. Returns false — never
 * throws — when the signing secret or any header is missing.
 */
export function verifySlackSignature({ signature, timestamp, body }) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !signature || !timestamp) return false;

  // Replay protection: reject anything older than 5 minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const expected = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reads the raw request body once and verifies its Slack signature. Returns
 * { ok, body } so the caller can then parse `body` itself (JSON for events,
 * urlencoded for slash commands / interactivity).
 */
export async function readVerified(request) {
  let body;
  try {
    body = await request.text();
  } catch (err) {
    throw new Error(`Failed to read Slack request body: ${err.message}`, { cause: err });
  }
  const ok = verifySlackSignature({
    signature: request.headers.get("x-slack-signature"),
    timestamp: request.headers.get("x-slack-request-timestamp"),
    body,
  });
  return { ok, body };
}

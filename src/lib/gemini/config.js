// Model configuration, error taxonomy, and SDK loading shared by every Gemini
// call site. Env vars are read at call/module-init time exactly as before the
// split — MODEL_ID is captured once per server process.

// One model for everything: gemini-3.1-flash-lite — newest stable lite
// generation, with the generous free-tier daily quota (gemini-3.5-flash's
// free tier allows only ~20 requests/day). Override with GEMINI_MODEL.
export const MODEL_ID = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

/** Sampling temperature per assistant mode (UI exposes these three). */
export const TEMPERATURES = { precise: 0.2, balanced: 0.6, creative: 0.95 };

/** Cap on document characters sent to the model; excess blocks are omitted. */
export const MAX_DOC_CHARS = 150_000;
/** Per-attachment character cap for reference files. */
export const MAX_ATTACHMENT_CHARS = 20_000;
/** How many prior chat messages are replayed as model context. */
export const MAX_HISTORY_MESSAGES = 20;

/**
 * Thrown when GEMINI_API_KEY is missing. Carries code "ai_not_configured" —
 * routes and the Slack bot branch on that code, so it must not change.
 */
export class AIConfigError extends Error {
  constructor(message) {
    super(message);
    this.code = "ai_not_configured";
  }
}

/** True when an SDK error looks like a daily-quota / rate-limit rejection. */
export const isQuotaError = (err) =>
  /RESOURCE_EXHAUSTED|exceeded your current quota|"code"\s*:\s*429/i.test(String(err?.message));

/**
 * Builds the user-facing quota error (code "ai_quota"). Its message is shown
 * verbatim in chat/Slack, so keep it human-readable.
 */
export const quotaError = () =>
  Object.assign(
    new Error(
      `Your Gemini API quota for ${MODEL_ID} is used up (the free tier allows ~20 requests/day). Wait for the daily reset or enable billing on your key, then try again.`
    ),
    { code: "ai_quota" }
  );

/**
 * Dynamically loads the @google/genai SDK (kept out of the main bundle).
 * Rethrows with context when the dependency itself is broken/missing.
 */
export async function loadGenAI() {
  try {
    return await import("@google/genai");
  } catch (err) {
    throw new Error(`Failed to load the @google/genai SDK: ${err.message}`, { cause: err });
  }
}

import { ALLOWED_STYLE_PROP_NAMES } from "../sanitize";
import {
  MODEL_ID, TEMPERATURES, MAX_HISTORY_MESSAGES,
  AIConfigError, isQuotaError, quotaError, loadGenAI,
} from "./config";
import { SYSTEM_PROMPT, buildUserTurn } from "./prompt";
import {
  parseModelJson, sanitizeResult, findUnsupportedStyleProps, allEditsNoop,
} from "./response";
import { mockAssistant } from "./mock";

// The main assistant turn: history + document blocks in, { reply, edits,
// title } out, with a one-shot self-correction when the model's edits would be
// invisible to the user.

// Structured-output schema. All keys required (nullable where they don't
// apply) — models love to omit optional fields, and an edit without html is
// useless.
const responseSchema = (Type) => ({
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    title: { type: Type.STRING, nullable: true },
    edits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          op: {
            type: Type.STRING,
            enum: ["replace", "insertAfter", "insertBefore", "delete", "setDocument"],
          },
          index: { type: Type.INTEGER, nullable: true },
          html: { type: Type.STRING, nullable: true },
        },
        required: ["op", "index", "html"],
        propertyOrdering: ["op", "index", "html"],
      },
    },
  },
  required: ["reply", "edits"],
  propertyOrdering: ["reply", "title", "edits"],
});

/**
 * Runs one assistant turn against the document. Returns a sanitized
 * { reply, edits, title }. Throws AIConfigError (code "ai_not_configured")
 * without a key, a code "ai_quota" error on quota exhaustion, and otherwise
 * surfaces the SDK error — callers map err.code/err.message to their UI.
 * MOCK_AI=1 short-circuits to the keyless mock assistant.
 */
export async function runAssistant({
  message,
  blocks = [],
  docTitle = "",
  history = [],
  attachments = [],
  mode = "balanced",
}) {
  if (process.env.MOCK_AI === "1") {
    await new Promise((r) => setTimeout(r, 600));
    return sanitizeResult(mockAssistant({ message, blocks }));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local (or set MOCK_AI=1 to try the app without a key)."
    );
  }

  const { GoogleGenAI, Type } = await loadGenAI();
  const ai = new GoogleGenAI({ apiKey });

  // Replay recent history so follow-ups ("make it shorter") have context; the
  // edit summary is appended so the model knows what its past turns changed.
  const contents = [];
  for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.editSummary ? `${msg.content}\n(Edits applied: ${msg.editSummary})` : msg.content }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: buildUserTurn({ message, blocks, docTitle, attachments }) }],
  });

  const callModel = async (turns) => {
    try {
      return await ai.models.generateContent({
        model: MODEL_ID,
        contents: turns,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: TEMPERATURES[mode] ?? TEMPERATURES.balanced,
          responseMimeType: "application/json",
          responseSchema: responseSchema(Type),
        },
      });
    } catch (err) {
      if (isQuotaError(err)) throw quotaError();
      if (/not[_ ]?found|does not exist|404/i.test(String(err?.message))) {
        throw new Error(
          `Model "${MODEL_ID}" isn't available for your API key. Set GEMINI_MODEL in .env.local to a model you can use.`
        );
      }
      throw err;
    }
  };

  let parsed;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await callModel(contents);
    parsed = parseModelJson(response.text);
    const rawEdits = Array.isArray(parsed?.edits) ? parsed.edits : [];
    const result = sanitizeResult(parsed);

    // Self-check: catch the ways an edit can "succeed" without the user ever
    // seeing a change, and make the model correct itself once.
    const problems = [];
    if (rawEdits.length && result.edits.length === 0) {
      problems.push(
        'Every replace/insertAfter/insertBefore op must include the complete "html" string (the full edited block) — yours were missing or invalid.'
      );
    }
    const badProps = findUnsupportedStyleProps(rawEdits);
    if (badProps.length) {
      problems.push(
        `You used unsupported style properties (${badProps.join(", ")}) which get stripped — the user would see NO change. Only these work: ${ALLOWED_STYLE_PROP_NAMES.join(", ")}. Achieve the effect with supported means (uppercase → rewrite the text in capitals; spacing → line-height; emphasis → <strong>/<em>/<u>/<s>/<mark>).`
      );
    }
    if (allEditsNoop(result.edits, blocks)) {
      problems.push(
        "Your replace ops resent the blocks UNCHANGED — nothing would happen. Actually apply the requested modification to the content."
      );
    }

    if (!problems.length || attempt === 1) return result;
    console.warn("[magicpen] AI edit self-check failed, retrying once:", problems.join(" | "));
    contents.push(
      { role: "model", parts: [{ text: response.text }] },
      {
        role: "user",
        parts: [{ text: `Fix your response and resend the ENTIRE corrected JSON. ${problems.join(" ")}` }],
      }
    );
  }
  return sanitizeResult(parsed);
}

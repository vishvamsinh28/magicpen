import { Users, GoogleLinks } from "@/lib/store";
import { runAssistant, summarizeEdits } from "@/lib/gemini";
import { htmlToBlocks, applyOpsToHtml } from "@/lib/blocks-server";
import { cleanDocHtml } from "@/lib/sanitize";
import { signConnectState, gdocsConnectUrl } from "@/lib/gdocs";

// The Docs add-on's brain — the same pipeline slack-actions.js uses, but much
// smaller because the Google Doc is the source of truth. Nothing is persisted:
// each call takes the doc's current HTML, runs the assistant, and returns the
// new HTML for the add-on to write back into the doc. (No versions / undo /
// chat history yet — those would need a bound Documents record; see the note in
// assistOnDoc.)

/* --------------------------- identity & linking --------------------------- */

// Resolve the SuperDocs account linked to a Google identity (the add-on user's
// email). Returns null when the user hasn't connected an account yet.
export async function resolveUserByGoogleId(googleUserId) {
  const link = await GoogleLinks.get(googleUserId);
  if (!link?.userId) return null;
  return Users.get(link.userId);
}

// Signs the short-lived connect link the add-on shows when the Google user
// hasn't linked a SuperDocs account. Clicking it opens the browser connect flow
// (/gdocs/connect), which proves their SuperDocs session and writes the link.
export async function connectUrlForGoogleUser(googleUserId) {
  const state = await signConnectState({ googleUserId });
  return gdocsConnectUrl(state);
}

/* ------------------------------- assist ----------------------------------- */

// Runs one AI turn against the doc's HTML. Stateless: no history is threaded in,
// so each instruction stands alone (the doc content carries the context). To
// add follow-up memory later, bind the doc to a Chat keyed by (user, docId) and
// pass Messages.list here — the same shape as SlackThreads/handleMessage.
//
// Returns the new full-document HTML plus a human-readable reply/summary for the
// sidebar. `changed` is false when the assistant only answered a question.
export async function assistOnDoc({ title, html, message, mode = "balanced" }) {
  const beforeHtml = html || "";
  const result = await runAssistant({
    message,
    blocks: htmlToBlocks(beforeHtml),
    docTitle: title || "",
    history: [],
    mode,
  });

  const afterHtml = result.edits.length
    ? cleanDocHtml(applyOpsToHtml(beforeHtml, result.edits))
    : beforeHtml;

  return {
    reply: result.reply,
    summary: summarizeEdits(result.edits),
    changed: afterHtml !== beforeHtml,
    html: afterHtml,
    edits: result.edits,
  };
}

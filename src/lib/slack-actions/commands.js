import { Documents, Versions, SlackLinks } from "@/lib/store";
import { connectUrl, signConnectState } from "@/lib/slack";
import { section, context, openLink, deSlackEscape, normalizeForMatch, stamp } from "./format";
import { resolveUser, connectPayload } from "./identity";

// The fast `/magicpen` subcommands (help / disconnect / list / open / commit)
// that answer inline as an ephemeral reply — no thread is posted.

// The full reference shown by `/magicpen help` — every feature, command, and
// in-thread action with examples, so users can discover what's possible.
function commandsHelp() {
  return {
    text: "MagicPen — everything I can do",
    blocks: [
      section("*MagicPen — everything I can do* 📄\nI create, edit, version, and manage documents right here in Slack, powered by AI. Everything syncs to your MagicPen account."),
      section(
        "*➕ Create & import*\n" +
        "• `/magicpen new <name>` — create a document with that name\n" +
        "       _example:_ `/magicpen new resume`\n" +
        "• `/magicpen new` — create an untitled doc (I'll name it from your first content)\n" +
        "• *Upload* — drag a `.docx` `.pdf` `.txt` `.rtf` `.md` `.html` file into this chat and I'll import it"
      ),
      section(
        "*💬 Work on a document — reply inside its thread*\n" +
        "When I create or open a doc, I post a *thread*. Do everything by replying in it:\n" +
        "• *Write / add content* — _\"write a resume for a backend engineer\"_\n" +
        "• *Edit* — _\"tighten the intro\"_ · _\"add a Projects section\"_ · _\"make it formal\"_ · _\"translate to Spanish\"_\n" +
        "• *Ask about it* — _\"what's in this doc?\"_ · _\"summarize the key points\"_\n\n" +
        "*Actions* — type the token exactly:\n" +
        "• `:send:` — get the file as Word _(also `:send: md` · `:send: html` · `:send: txt`)_\n" +
        "• `:commit:` or `:commit: <label>` — save a version snapshot\n" +
        "• `:undo:` — revert the last change\n" +
        "• `:rename: <new name>` — rename this document\n" +
        "• `:delete:` — delete this document _(asks you to confirm)_"
      ),
      section(
        "*🔎 Find & open*\n" +
        "• `/magicpen list` — your recent documents\n" +
        "• `/magicpen open <title>` — open an existing doc as a working thread\n" +
        "       _example:_ `/magicpen open rent` opens \"Rent Agreement\" _(partial titles are fine)_"
      ),
      section(
        "*⚙️ Account & cleanup*\n" +
        "• *Connect* — DM me and tap *Connect MagicPen* _(one-time)_\n" +
        "• `/magicpen disconnect` — unlink, to switch accounts\n" +
        "• `/magicpen clear` — delete all of my messages & files in this chat\n" +
        "• `/magicpen help` — show this list"
      ),
      context("Tip: plain messages don't create anything — use `/magicpen new` or reply inside a document's thread."),
    ],
  };
}

/**
 * Dispatches `/magicpen <sub>` for the fast subcommands and returns a payload
 * the route sends as an ephemeral reply. (`new`, `open`-as-thread and `clear`
 * are handled asynchronously by the route via their own handlers.)
 */
export async function handleSlashCommand({ teamId, slackUserId, text }) {
  const parts = String(text || "").trim().split(/\s+/);
  const sub = (parts[0] || "").toLowerCase();
  const arg = parts.slice(1).join(" ").trim();

  // These work without (or regardless of) an account link.
  if (!sub || sub === "help") {
    return commandsHelp();
  }

  if (sub === "disconnect") {
    const existing = await SlackLinks.get(teamId, slackUserId);
    if (!existing) {
      return { text: "Not connected.", blocks: [section("You're not connected to a MagicPen account. DM me to connect one.")] };
    }
    await SlackLinks.unlink(teamId, slackUserId);
    return { text: "Disconnected.", blocks: [section("✅ Disconnected from MagicPen. DM me *hi* to connect a different account.")] };
  }

  const user = await resolveUser(teamId, slackUserId);
  if (!user) {
    const state = await signConnectState({ teamId, slackUserId });
    return connectPayload(connectUrl(state));
  }

  if (sub === "list") {
    const docs = (await Documents.list(user.id)).slice(0, 25);
    if (!docs.length) return { text: "No documents yet.", blocks: [section("You don't have any documents yet. Try `/magicpen new <name>`.")] };
    return {
      text: "Your recent documents",
      blocks: [
        section("*Your recent documents*"),
        section(docs.map((d) => `• *${d.title}* — ${openLink(d.id)}  _(updated ${new Date(d.updatedAt).toLocaleDateString()})_`).join("\n")),
      ],
    };
  }

  if (sub === "open") {
    const query = deSlackEscape(arg).trim();
    if (!query) return { text: "Usage", blocks: [section("Usage: `/magicpen open <title>`")] };
    const docs = await Documents.list(user.id);
    const nq = normalizeForMatch(query);
    // Prefer an exact (normalized) title, else the first that contains the query.
    const match =
      (nq && docs.find((d) => normalizeForMatch(d.title) === nq)) ||
      (nq && docs.find((d) => normalizeForMatch(d.title).includes(nq)));
    if (!match) return { text: "No match.", blocks: [section(`No document matching *${query}*. Try \`/magicpen list\`.`)] };
    return { text: match.title, blocks: [section(`*${match.title}* — ${openLink(match.id)}`)] };
  }

  if (sub === "commit") {
    // Commits the most recently updated document (list is newest-first).
    const docs = await Documents.list(user.id);
    const doc = docs[0];
    if (!doc) return { text: "Nothing to commit.", blocks: [section("You don't have any documents to commit yet.")] };
    const count = (await Versions.list(doc.id, user.id)).length;
    const label = arg || `From Slack · ${stamp()}`;
    await Versions.add({ userId: user.id, documentId: doc.id, label: label.slice(0, 120), contentHtml: doc.contentHtml || "" });
    return { text: "Committed.", blocks: [section(`💾 Committed version ${count + 1} of *${doc.title}* — _${label}_.`)] };
  }

  if (sub === "new") {
    // Handled asynchronously by the route via createDocFromSlash; if it lands
    // here it means the route didn't special-case it.
    return { text: "Use /magicpen new <name>", blocks: [section("Usage: `/magicpen new <name>`")] };
  }

  return { text: "Unknown command", blocks: [section(`Unknown command \`${sub}\`. Try \`/magicpen help\`.`)] };
}

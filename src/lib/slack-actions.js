// The bot's brain. Interaction model:
//   • A plain message that isn't in a document thread never creates anything —
//     it replies with guidance to use commands.
//   • Documents are created only via `/magicpen new` (which posts a thread) or
//     by uploading a file.
//   • Everything about a specific document happens inside that document's
//     thread: reply to edit/ask, or type `commit` / `undo` / `send`.
//   • The actual file is delivered into Slack on create, on every edit, and on
//     `send`. No interactive buttons — commands + threads only.
//
// This file is the module's public entry — implementation lives in
// src/lib/slack-actions/ (identity, formatting, doc operations, upload,
// message handler, slash handlers, clear) and is re-exported here so the API
// routes never need deep paths.

export { botTokenForTeam } from "./slack-actions/identity";
export { handleMessage } from "./slack-actions/messages";
export { createDocFromSlash, openDocFromSlash } from "./slack-actions/slash";
export { handleSlashCommand } from "./slack-actions/commands";
export { clearConversation } from "./slack-actions/clear";

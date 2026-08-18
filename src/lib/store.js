/**
 * Data access layer — public entry point. Uses MongoDB when MONGODB_URI is
 * set, otherwise falls back to a JSON file store in .data/ so the app runs
 * with zero config in dev (see ./store/backend). Every record carries a
 * userId and every query filters by it, so one user's data is never visible
 * to another.
 *
 * Split by concern under ./store/; this barrel re-exports the collection
 * APIs so existing `@/lib/store` imports keep working unchanged.
 */

export { Users, Documents, Chats, Messages } from "./store/core";
export { Shares, Comments, DocStates, DocUpdates, Presence } from "./store/sharing";
export { Versions, Changes } from "./store/history";
export {
  SlackInstalls, SlackLinks, GoogleLinks, SlackThreads, SlackDebug, SlackEvents,
} from "./store/integrations";

import { store } from "./backend";
import { now, newId } from "./ids";

/**
 * Edit-history collections: manual version snapshots and the AI change log.
 * Both are (documentId, userId)-scoped like documents themselves.
 */

/**
 * Manual commits: full snapshots the user explicitly saves. Nothing is
 * created automatically — a document only has the versions its owner commits.
 */
export const Versions = {
  list: (documentId, userId) =>
    store().find("versions", { documentId, userId }, { sort: ["createdAt", -1] }),
  get: (id, userId) => store().findOne("versions", { id, userId }),
  add: ({ userId, documentId, label = "", contentHtml = "" }) =>
    store().insert("versions", {
      id: newId(),
      userId,
      documentId,
      label,
      contentHtml,
      createdAt: now(),
    }),
  update: (id, userId, patch) => store().update("versions", { id, userId }, patch),
  remove: (id, userId) => store().removeWhere("versions", { id, userId }),
};

/**
 * AI edit log: one record per applied/proposed change set, with the ops and
 * the before/after HTML so a change can be reviewed or reverted later.
 */
export const Changes = {
  list: (documentId, userId) =>
    store().find("changes", { documentId, userId }, { sort: ["createdAt", -1] }),
  add: ({ userId, documentId, chatId = null, summary, ops = [], beforeHtml = "", afterHtml = "", status = "applied" }) =>
    store().insert("changes", {
      id: newId(),
      userId,
      documentId,
      chatId,
      summary,
      ops,
      beforeHtml,
      afterHtml,
      status,
      createdAt: now(),
      updatedAt: now(),
    }),
  update: (id, userId, patch) =>
    store().update("changes", { id, userId }, { ...patch, updatedAt: now() }),
};

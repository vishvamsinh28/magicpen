import { store } from "./backend";
import { now, newId } from "./ids";

/**
 * Core owner-scoped collections: users, documents, chats, and chat messages.
 * Every record carries a userId and every query filters by it, so one user's
 * data is never visible to another.
 */

/** Account records. Emails are normalized (lowercase, trimmed) on both read and write. */
export const Users = {
  get: (id) => store().findOne("users", { id }),
  findByEmail: (email) => store().findOne("users", { email: String(email).toLowerCase().trim() }),
  create: ({ name = null, email, passwordHash }) =>
    store().insert("users", {
      id: newId(),
      name,
      email: String(email).toLowerCase().trim(),
      passwordHash,
      createdAt: now(),
    }),
};

/**
 * Documents and their cascade delete. Reads/writes are (id, userId)-scoped;
 * remove() also clears every dependent record so a deleted document leaves
 * no orphaned history or collaboration state behind.
 */
export const Documents = {
  list: (userId) => store().find("documents", { userId }, { sort: ["updatedAt", -1] }),
  get: (id, userId) => store().findOne("documents", { id, userId }),
  create: ({ userId, title = "Untitled document", contentHtml = "", sourceFile = null }) =>
    store().insert("documents", {
      id: newId(),
      userId,
      title,
      contentHtml,
      sourceFile,
      createdAt: now(),
      updatedAt: now(),
    }),
  update: (id, userId, patch) =>
    store().update("documents", { id, userId }, { ...patch, updatedAt: now() }),
  remove: async (id, userId) => {
    await store().removeWhere("documents", { id, userId });
    await store().removeWhere("changes", { documentId: id, userId });
    await store().removeWhere("versions", { documentId: id, userId });
    // Collaboration state is keyed by document only — it dies with the document.
    await store().removeWhere("shares", { documentId: id });
    await store().removeWhere("comments", { documentId: id });
    await store().removeWhere("docstates", { documentId: id });
    await store().removeWhere("docupdates", { documentId: id });
    await store().removeWhere("presence", { documentId: id });
  },
};

/**
 * Chat conversations. A chat may be bound to a document (scope "document")
 * or stand alone; removing a chat also drops its messages.
 */
export const Chats = {
  list: (userId) => store().find("chats", { userId }, { sort: ["updatedAt", -1] }),
  get: (id, userId) => store().findOne("chats", { id, userId }),
  create: ({ userId, title = "New conversation", scope = "document", documentId = null }) =>
    store().insert("chats", {
      id: newId(),
      userId,
      title,
      scope,
      documentId,
      createdAt: now(),
      updatedAt: now(),
    }),
  update: (id, userId, patch) =>
    store().update("chats", { id, userId }, { ...patch, updatedAt: now() }),
  remove: async (id, userId) => {
    const chat = await store().findOne("chats", { id, userId });
    if (!chat) return;
    await store().removeWhere("chats", { id, userId });
    await store().removeWhere("messages", { chatId: id });
  },
};

/**
 * Chat messages. Access is always through an ownership-checked chat, so
 * queries key on chatId alone.
 */
export const Messages = {
  list: (chatId) => store().find("messages", { chatId }, { sort: ["createdAt", 1] }),
  add: ({ chatId, userId, role, content, attachments = [], edits = null, editSummary = null }) =>
    store().insert("messages", {
      id: newId(),
      chatId,
      userId,
      role,
      content,
      attachments,
      edits,
      editSummary,
      createdAt: now(),
    }),
};

import { store } from "./backend";
import { now, newId } from "./ids";

/**
 * Sharing and live-collaboration collections: share links, comment threads,
 * and the Yjs sync state (snapshot + update tail + presence).
 */

/**
 * Share links. A share is a capability: whoever holds the token gets `role`
 * on the document. Ownership checks still run separately — a share never
 * grants owner rights.
 */
export const Shares = {
  listForDocument: (documentId, ownerId) =>
    store().find("shares", { documentId, ownerId }, { sort: ["createdAt", -1] }),
  get: (id, ownerId) => store().findOne("shares", { id, ownerId }),
  getByToken: (token) => store().findOne("shares", { token }),
  create: ({ ownerId, documentId, token, role = "view", allowDownload = true }) =>
    store().insert("shares", {
      id: newId(),
      ownerId,
      documentId,
      token,
      role,
      allowDownload,
      revoked: false,
      createdAt: now(),
      updatedAt: now(),
    }),
  update: (id, ownerId, patch) =>
    store().update("shares", { id, ownerId }, { ...patch, updatedAt: now() }),
  remove: (id, ownerId) => store().removeWhere("shares", { id, ownerId }),
};

/**
 * Comments, grouped into threads by threadId; the thread id is also the
 * value of the comment mark in the document, which is how they stay anchored.
 */
export const Comments = {
  listForDocument: (documentId) =>
    store().find("comments", { documentId }, { sort: ["createdAt", 1] }),
  get: (id) => store().findOne("comments", { id }),
  create: ({ documentId, threadId, authorId, authorName, authorKind = "user", body, quote = "" }) =>
    store().insert("comments", {
      id: newId(),
      documentId,
      threadId,
      authorId,
      authorName,
      authorKind,
      body,
      quote,
      resolved: false,
      resolvedBy: null,
      createdAt: now(),
      updatedAt: now(),
    }),
  update: (id, patch) => store().update("comments", { id }, { ...patch, updatedAt: now() }),
  remove: (id) => store().removeWhere("comments", { id }),
  removeThread: (documentId, threadId) => store().removeWhere("comments", { documentId, threadId }),
};

/* ------------------------- Collaboration (Yjs) ---------------------------- */
// The live document is a Yjs CRDT. `docstates` holds a compacted snapshot and
// `docupdates` the tail of incremental updates since it; clients pull whatever
// is newer than the sequence number they hold. Yjs updates are commutative, so
// no server-side conflict resolution is needed — plain HTTP polling is enough
// and there is no WebSocket server to run.

// A winner that never delivers content releases its reservation after this,
// so a crash during seeding can't leave the document permanently empty.
const SEED_LOCK_STALE_MS = 8000;

/**
 * Per-document Yjs snapshot rows, including the seed lock that elects exactly
 * one client to plant a shared document's initial content.
 */
export const DocStates = {
  get: (documentId) => store().findOne("docstates", { documentId }),
  // Returns { won } — true only for the single caller allowed to plant content.
  claimSeed: (documentId) => store().claimSeed(documentId, SEED_LOCK_STALE_MS),
  async upsert(documentId, patch) {
    const existing = await store().findOne("docstates", { documentId });
    if (existing) return store().update("docstates", { documentId }, { ...patch, updatedAt: now() });
    try {
      return await store().insert("docstates", {
        id: newId(),
        documentId,
        state: null,
        seq: 0,
        seeded: false,
        ...patch,
        updatedAt: now(),
      });
    } catch {
      // Lost the create race to a concurrent request (the unique documentId
      // index rejected the second insert) — the row exists now, so update it.
      return store().update("docstates", { documentId }, { ...patch, updatedAt: now() });
    }
  },
};

/** Incremental Yjs updates since the last snapshot, ordered by seq. */
export const DocUpdates = {
  list: (documentId) => store().find("docupdates", { documentId }, { sort: ["seq", 1] }),
  add: ({ documentId, seq, update, actorId }) =>
    store().insert("docupdates", {
      id: newId(),
      documentId,
      seq,
      update,
      actorId,
      createdAt: now(),
    }),
  clear: (documentId) => store().removeWhere("docupdates", { documentId }),
};

/** Who is currently viewing/editing a document, refreshed by the sync poll. */
export const Presence = {
  list: (documentId) => store().find("presence", { documentId }),
  // Atomic upsert keyed on { documentId, actorId } — a single actor always maps
  // to exactly one presence row, even when two of their tabs (or a StrictMode
  // double-mount) fire their first sync at the same instant.
  touch: ({ documentId, actorId, name, color, role }) =>
    store().upsert("presence", { documentId, actorId }, { name, color, role, lastSeenAt: now() }),
  remove: (documentId, actorId) => store().removeWhere("presence", { documentId, actorId }),
};

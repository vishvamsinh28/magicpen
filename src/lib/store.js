import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Data access layer. Uses MongoDB when MONGODB_URI is set, otherwise falls
// back to a JSON file store in .data/ so the app runs with zero config in dev.
// Every record carries a userId and every query filters by it, so one user's
// data is never visible to another.

export const now = () => new Date().toISOString();
export const newId = () => randomUUID();

const EMPTY = {
  users: [], documents: [], chats: [], messages: [], changes: [], versions: [],
  shares: [], comments: [], docstates: [], docupdates: [], presence: [],
  slackinstalls: [], slacklinks: [], slackthreads: [], slackdebug: [], slackevents: [],
  googlelinks: [],
};

/* ------------------------------ Mongo store ------------------------------ */

function mongoStore(uri) {
  const dbName = process.env.MONGODB_DB || "magicpen";

  async function db() {
    if (!globalThis.__magicpenMongo) {
      globalThis.__magicpenMongo = (async () => {
        const { MongoClient } = await import("mongodb");
        const client = new MongoClient(uri);
        await client.connect();
        const d = client.db(dbName);
        await Promise.all([
          d.collection("users").createIndex({ email: 1 }, { unique: true }),
          d.collection("documents").createIndex({ userId: 1, updatedAt: -1 }),
          d.collection("chats").createIndex({ userId: 1, updatedAt: -1 }),
          d.collection("messages").createIndex({ chatId: 1, createdAt: 1 }),
          d.collection("changes").createIndex({ userId: 1, documentId: 1, createdAt: -1 }),
          d.collection("versions").createIndex({ userId: 1, documentId: 1, createdAt: -1 }),
          d.collection("shares").createIndex({ token: 1 }, { unique: true }),
          d.collection("shares").createIndex({ documentId: 1, createdAt: -1 }),
          d.collection("comments").createIndex({ documentId: 1, createdAt: 1 }),
          d.collection("docstates").createIndex({ documentId: 1 }, { unique: true }),
          d.collection("docupdates").createIndex({ documentId: 1, seq: 1 }),
          d.collection("presence").createIndex({ documentId: 1, actorId: 1 }, { unique: true }),
          d.collection("slackinstalls").createIndex({ teamId: 1 }, { unique: true }),
          d.collection("slacklinks").createIndex({ teamId: 1, slackUserId: 1 }, { unique: true }),
          d.collection("slackthreads").createIndex({ teamId: 1, channelId: 1, threadTs: 1 }, { unique: true }),
          d.collection("googlelinks").createIndex({ googleUserId: 1 }, { unique: true }),
        ]).catch(() => {});
        return d;
      })();
    }
    return globalThis.__magicpenMongo;
  }

  const toMongo = (query) => {
    const { id, ...rest } = query;
    return id !== undefined ? { _id: id, ...rest } : rest;
  };

  const strip = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  };

  return {
    async insert(col, record) {
      const d = await db();
      const { id, ...fields } = record;
      await d.collection(col).insertOne({ _id: id, ...fields });
      return record;
    },
    async findOne(col, query) {
      const d = await db();
      return strip(await d.collection(col).findOne(toMongo(query)));
    },
    async update(col, query, patch) {
      const d = await db();
      const res = await d
        .collection(col)
        .findOneAndUpdate(toMongo(query), { $set: patch }, { returnDocument: "after" });
      return strip(res);
    },
    async removeWhere(col, query) {
      const d = await db();
      await d.collection(col).deleteMany(toMongo(query));
    },
    async find(col, query = {}, { sort, limit } = {}) {
      const d = await db();
      let cursor = d.collection(col).find(toMongo(query));
      if (sort) cursor = cursor.sort({ [sort[0]]: sort[1] });
      if (limit) cursor = cursor.limit(limit);
      return (await cursor.toArray()).map(strip);
    },
    // Insert-or-update keyed on `query` in a single atomic step. Callers rely on
    // this to avoid the findOne-then-insert race that duplicates rows; a unique
    // index on the query keys is what makes concurrent upserts collapse onto one
    // document. If two race the insert, the loser gets a duplicate-key error —
    // the row exists by then, so fall back to a plain update.
    async upsert(col, query, fields) {
      const d = await db();
      const filter = toMongo(query);
      try {
        const res = await d.collection(col).findOneAndUpdate(
          filter,
          { $set: fields, $setOnInsert: { _id: filter._id ?? newId() } },
          { upsert: true, returnDocument: "after" }
        );
        return strip(res);
      } catch {
        const res = await d
          .collection(col)
          .findOneAndUpdate(filter, { $set: fields }, { returnDocument: "after" });
        return strip(res);
      }
    },
    // Atomically reserve the right to plant a shared document's initial content.
    // Grants only when nobody has seeded and no fresh reservation is held; a
    // stale lock (a winner that never delivered content) is reclaimable so the
    // document can't get stuck empty. Single findOneAndUpdate → race-safe.
    async claimSeed(documentId, staleMs) {
      const d = await db();
      const col = d.collection("docstates");
      await col
        .updateOne(
          { documentId },
          { $setOnInsert: { _id: newId(), documentId, state: null, seq: 0, seeded: false, seedLockAt: null, updatedAt: now() } },
          { upsert: true }
        )
        .catch(() => {}); // concurrent upsert loses the unique index race — fine
      const staleBefore = new Date(Date.now() - staleMs).toISOString();
      const res = await col.findOneAndUpdate(
        {
          documentId,
          seeded: { $ne: true },
          $or: [{ seedLockAt: null }, { seedLockAt: { $lt: staleBefore } }],
        },
        { $set: { seedLockAt: now(), updatedAt: now() } },
        { returnDocument: "after" }
      );
      return { won: !!res };
    },
  };
}

/* ---------------------------- JSON file store ----------------------------- */

function fileStore() {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "magicpen.json");

  async function load() {
    if (!globalThis.__magicpenFileData) {
      globalThis.__magicpenFileData = (async () => {
        try {
          const data = JSON.parse(await fs.readFile(file, "utf8"));
          return { ...structuredClone(EMPTY), ...data };
        } catch {
          console.warn(
            "[magicpen] MONGODB_URI not set — using local JSON store at .data/magicpen.json"
          );
          return structuredClone(EMPTY);
        }
      })();
    }
    return globalThis.__magicpenFileData;
  }

  let queue = Promise.resolve();
  function persist(data) {
    queue = queue
      .then(async () => {
        await fs.mkdir(dir, { recursive: true });
        const tmp = `${file}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(data));
        await fs.rename(tmp, file);
      })
      .catch((e) => console.error("[magicpen] failed to persist store:", e));
    return queue;
  }

  const matches = (record, query) =>
    Object.entries(query).every(([k, v]) => record[k] === v);

  return {
    async insert(col, record) {
      const data = await load();
      data[col].push(record);
      await persist(data);
      return record;
    },
    async findOne(col, query) {
      const data = await load();
      return data[col].find((r) => matches(r, query)) || null;
    },
    async update(col, query, patch) {
      const data = await load();
      const idx = data[col].findIndex((r) => matches(r, query));
      if (idx === -1) return null;
      data[col][idx] = { ...data[col][idx], ...patch };
      await persist(data);
      return data[col][idx];
    },
    async removeWhere(col, query) {
      const data = await load();
      data[col] = data[col].filter((r) => !matches(r, query));
      await persist(data);
    },
    async find(col, query = {}, { sort, limit } = {}) {
      const data = await load();
      let out = data[col].filter((r) => matches(r, query));
      if (sort) {
        const [field, dir] = sort;
        out = [...out].sort(
          (a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * dir
        );
      }
      if (limit) out = out.slice(0, limit);
      return out;
    },
    // See the Mongo variant. The find-and-create runs synchronously after the
    // single await, so two concurrent callers can't both insert in one process.
    async upsert(col, query, fields) {
      const data = await load();
      const row = data[col].find((r) => matches(r, query));
      if (row) {
        Object.assign(row, fields);
        await persist(data);
        return row;
      }
      const created = { id: newId(), ...query, ...fields };
      data[col].push(created);
      await persist(data);
      return created;
    },
    // See the Mongo variant. The check-and-set runs synchronously after the
    // single await, so two concurrent callers can't both win in one process.
    async claimSeed(documentId, staleMs) {
      const data = await load();
      let row = data.docstates.find((r) => r.documentId === documentId);
      if (!row) {
        row = { id: newId(), documentId, state: null, seq: 0, seeded: false, seedLockAt: null, updatedAt: now() };
        data.docstates.push(row);
      }
      const stale = !row.seedLockAt || Date.now() - new Date(row.seedLockAt).getTime() > staleMs;
      if (row.seeded === true || !stale) return { won: false };
      row.seedLockAt = now();
      row.updatedAt = now();
      await persist(data);
      return { won: true };
    },
  };
}

function store() {
  if (!globalThis.__magicpenStore) {
    const uri = process.env.MONGODB_URI;
    globalThis.__magicpenStore = uri ? mongoStore(uri) : fileStore();
  }
  return globalThis.__magicpenStore;
}

/* --------------------------------- Users ---------------------------------- */

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

/* ------------------------------- Documents ------------------------------- */

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

/* --------------------------------- Chats --------------------------------- */

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

/* -------------------------------- Messages -------------------------------- */
// Access is always through an ownership-checked chat, so queries key on chatId.

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

/* --------------------------------- Shares --------------------------------- */
// A share is a capability: whoever holds the token gets `role` on the document.
// Ownership checks still run separately — a share never grants owner rights.

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

/* -------------------------------- Comments -------------------------------- */
// Comments are grouped into threads by threadId; the thread id is also the
// value of the comment mark in the document, which is how they stay anchored.

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

export const Presence = {
  list: (documentId) => store().find("presence", { documentId }),
  // Atomic upsert keyed on { documentId, actorId } — a single actor always maps
  // to exactly one presence row, even when two of their tabs (or a StrictMode
  // double-mount) fire their first sync at the same instant.
  touch: ({ documentId, actorId, name, color, role }) =>
    store().upsert("presence", { documentId, actorId }, { name, color, role, lastSeenAt: now() }),
  remove: (documentId, actorId) => store().removeWhere("presence", { documentId, actorId }),
};

/* -------------------------------- Versions -------------------------------- */
// Manual commits: full snapshots the user explicitly saves. Nothing is
// created automatically — a document only has the versions its owner commits.

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

/* -------------------------------- Changes --------------------------------- */

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

/* ------------------------------ Slack installs ---------------------------- */
// One row per workspace that installed the app. Public distribution means each
// install mints its own bot token, so inbound events look the token up by the
// team id carried in the payload. Keyed (and uniquely indexed) on teamId.

export const SlackInstalls = {
  getByTeam: (teamId) => store().findOne("slackinstalls", { teamId }),
  save: ({ teamId, teamName = null, botToken, botUserId = null, appId = null, authedUserId = null }) =>
    store().upsert(
      "slackinstalls",
      { teamId },
      { teamName, botToken, botUserId, appId, authedUserId, updatedAt: now() }
    ),
  remove: (teamId) => store().removeWhere("slackinstalls", { teamId }),
};

/* ------------------------------- Slack links ------------------------------ */
// Maps a Slack identity (team + user) to a MagicPen account so the bot can act
// as that user. Written by the browser connect flow, which proves the MagicPen
// session before linking. Keyed (and uniquely indexed) on (teamId, slackUserId).

export const SlackLinks = {
  get: (teamId, slackUserId) => store().findOne("slacklinks", { teamId, slackUserId }),
  link: ({ teamId, slackUserId, userId }) =>
    store().upsert("slacklinks", { teamId, slackUserId }, { userId, updatedAt: now() }),
  unlink: (teamId, slackUserId) => store().removeWhere("slacklinks", { teamId, slackUserId }),
};

/* ------------------------------ Google links ------------------------------ */
// Maps a Google identity (the add-on user's email) to a MagicPen account so
// the Docs add-on can act as that user. Written by the browser connect flow,
// which proves the MagicPen session before linking — the same pattern as
// SlackLinks. Keyed (and uniquely indexed) on googleUserId.

export const GoogleLinks = {
  get: (googleUserId) => store().findOne("googlelinks", { googleUserId }),
  link: ({ googleUserId, userId }) =>
    store().upsert("googlelinks", { googleUserId }, { userId, updatedAt: now() }),
  unlink: (googleUserId) => store().removeWhere("googlelinks", { googleUserId }),
};

/* ------------------------------ Slack threads ----------------------------- */
// Binds a Slack conversation thread to a MagicPen document + chat so follow-up
// messages in the same thread keep operating on the same document. Keyed (and
// uniquely indexed) on (teamId, channelId, threadTs).

export const SlackThreads = {
  get: (teamId, channelId, threadTs) =>
    store().findOne("slackthreads", { teamId, channelId, threadTs }),
  bind: ({ teamId, channelId, threadTs, userId, documentId, chatId }) =>
    store().upsert(
      "slackthreads",
      { teamId, channelId, threadTs },
      { userId, documentId, chatId, updatedAt: now() }
    ),
};

/* ------------------------------- Slack debug ------------------------------ */
// Temporary observability for wiring up the Slack integration: every inbound
// request and handler outcome is appended here so failures (events not
// arriving, signature mismatch, missing token, Slack API errors) are visible
// without server log access. Safe to remove once the bot is working.

export const SlackDebug = {
  log: (record) => store().insert("slackdebug", { id: newId(), ...record, createdAt: now() }),
  recent: (n = 30) => store().find("slackdebug", {}, { sort: ["createdAt", -1], limit: n }),
};

/* ------------------------------ Slack events ------------------------------ */
// Idempotency guard: Slack re-delivers events on timeout/retry, and the bot
// mutates documents, so each event must be handled at most once. claim() wins
// exactly once per eventId (the _id unique constraint is atomic in Mongo);
// release() lets a genuinely-failed handler be retried.

export const SlackEvents = {
  claim: async (eventId) => {
    try {
      await store().insert("slackevents", { id: eventId, createdAt: now() });
      return true;
    } catch {
      return false; // already claimed
    }
  },
  release: (eventId) => store().removeWhere("slackevents", { id: eventId }),
};

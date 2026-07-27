import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Data access layer. Uses MongoDB when MONGODB_URI is set, otherwise falls
// back to a JSON file store in .data/ so the app runs with zero config in dev.
// Every record carries a userId and every query filters by it, so one user's
// data is never visible to another.

export const now = () => new Date().toISOString();
export const newId = () => randomUUID();

const EMPTY = { users: [], documents: [], chats: [], messages: [], changes: [], versions: [] };

/* ------------------------------ Mongo store ------------------------------ */

function mongoStore(uri) {
  const dbName = process.env.MONGODB_DB || "superdocs";

  async function db() {
    if (!globalThis.__superdocsMongo) {
      globalThis.__superdocsMongo = (async () => {
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
        ]).catch(() => {});
        return d;
      })();
    }
    return globalThis.__superdocsMongo;
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
  };
}

/* ---------------------------- JSON file store ----------------------------- */

function fileStore() {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "superdocs.json");

  async function load() {
    if (!globalThis.__superdocsFileData) {
      globalThis.__superdocsFileData = (async () => {
        try {
          const data = JSON.parse(await fs.readFile(file, "utf8"));
          return { ...structuredClone(EMPTY), ...data };
        } catch {
          console.warn(
            "[superdocs] MONGODB_URI not set — using local JSON store at .data/superdocs.json"
          );
          return structuredClone(EMPTY);
        }
      })();
    }
    return globalThis.__superdocsFileData;
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
      .catch((e) => console.error("[superdocs] failed to persist store:", e));
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
  };
}

function store() {
  if (!globalThis.__superdocsStore) {
    const uri = process.env.MONGODB_URI;
    globalThis.__superdocsStore = uri ? mongoStore(uri) : fileStore();
  }
  return globalThis.__superdocsStore;
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

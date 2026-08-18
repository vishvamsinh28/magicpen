import { now, newId } from "./ids";

/**
 * MongoDB backend for the data access layer. Records use the app-level `id`
 * as Mongo's `_id`; `toMongo`/`strip` translate between the two shapes so
 * collection modules never see driver-specific field names.
 */

/**
 * Lazily connect and cache the db handle on globalThis (intentional singleton:
 * Next.js dev hot-reloads re-evaluate modules, and the shared promise keeps one
 * connection pool per process instead of one per reload).
 */
async function db(uri) {
  if (!globalThis.__magicpenMongo) {
    globalThis.__magicpenMongo = (async () => {
      const dbName = process.env.MONGODB_DB || "magicpen";
      let d;
      try {
        const { MongoClient } = await import("mongodb");
        const client = new MongoClient(uri);
        await client.connect();
        d = client.db(dbName);
      } catch (err) {
        throw new Error(`MongoDB connection failed (db "${dbName}"): ${err.message}`, { cause: err });
      }
      // Best-effort: index creation may race across instances or lack
      // permissions — the app still works, just slower, so warn and continue.
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
      ]).catch((err) => console.warn("[magicpen] Mongo index creation skipped:", err?.message));
      return d;
    })();
  }
  return globalThis.__magicpenMongo;
}

/** App query → Mongo filter: the app-level `id` field becomes `_id`. */
const toMongo = (query) => {
  const { id, ...rest } = query;
  return id !== undefined ? { _id: id, ...rest } : rest;
};

/** Mongo doc → app record: `_id` becomes `id`. Null passes through for misses. */
const strip = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};

/**
 * Build the Mongo-backed store. Same interface as fileStore() in ./file so
 * collection modules stay backend-agnostic: insert / findOne / update /
 * removeWhere / find / upsert / claimSeed.
 */
export function mongoStore(uri) {
  return {
    async insert(col, record) {
      const d = await db(uri);
      const { id, ...fields } = record;
      await d.collection(col).insertOne({ _id: id, ...fields });
      return record;
    },
    async findOne(col, query) {
      const d = await db(uri);
      return strip(await d.collection(col).findOne(toMongo(query)));
    },
    async update(col, query, patch) {
      const d = await db(uri);
      const res = await d
        .collection(col)
        .findOneAndUpdate(toMongo(query), { $set: patch }, { returnDocument: "after" });
      return strip(res);
    },
    async removeWhere(col, query) {
      const d = await db(uri);
      await d.collection(col).deleteMany(toMongo(query));
    },
    async find(col, query = {}, { sort, limit } = {}) {
      const d = await db(uri);
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
      const d = await db(uri);
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
      const d = await db(uri);
      const col = d.collection("docstates");
      await col
        .updateOne(
          { documentId },
          { $setOnInsert: { _id: newId(), documentId, state: null, seq: 0, seeded: false, seedLockAt: null, updatedAt: now() } },
          { upsert: true }
        )
        .catch((err) => {
          // E11000 duplicate key = lost the seed-row creation race — benign.
          // Anything else will resurface on the findOneAndUpdate below.
          if (err?.code !== 11000) console.warn("[magicpen] docstates seed-row create failed:", err?.message);
        });
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

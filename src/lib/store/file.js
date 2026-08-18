import { promises as fs } from "fs";
import path from "path";
import { now, newId } from "./ids";

/**
 * JSON file backend for the data access layer — the zero-config dev fallback
 * used when MONGODB_URI is unset. The whole dataset lives in memory and is
 * flushed to .data/magicpen.json through a serialized write queue.
 */

/** Every collection the store knows about; new datasets start from this shape. */
const EMPTY = {
  users: [], documents: [], chats: [], messages: [], changes: [], versions: [],
  shares: [], comments: [], docstates: [], docupdates: [], presence: [],
  slackinstalls: [], slacklinks: [], slackthreads: [], slackdebug: [], slackevents: [],
  googlelinks: [],
};

/**
 * Build the file-backed store. Same interface as mongoStore() in ./mongo:
 * insert / findOne / update / removeWhere / find / upsert / claimSeed.
 * Single-process only — mutations are applied to the in-memory dataset and
 * persisted asynchronously, so concurrent server instances would clobber
 * each other (which is fine for the dev scenario it exists for).
 */
export function fileStore() {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "magicpen.json");

  // Dataset cached on globalThis (intentional singleton: survives Next.js dev
  // hot reloads so all route handlers share one in-memory copy).
  async function load() {
    if (!globalThis.__magicpenFileData) {
      globalThis.__magicpenFileData = (async () => {
        try {
          const data = JSON.parse(await fs.readFile(file, "utf8"));
          return { ...structuredClone(EMPTY), ...data };
        } catch {
          // Missing or corrupt file — start fresh; the warn doubles as the
          // "you are on the JSON fallback" notice.
          console.warn(
            "[magicpen] MONGODB_URI not set — using local JSON store at .data/magicpen.json"
          );
          return structuredClone(EMPTY);
        }
      })();
    }
    return globalThis.__magicpenFileData;
  }

  // Writes chain onto one queue so snapshots reach disk in order; the tmp-file
  // rename makes each flush atomic (no torn JSON on crash).
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

  /** Shallow equality match: every key in `query` must equal the record's value. */
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

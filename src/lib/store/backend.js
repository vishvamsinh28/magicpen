import { mongoStore } from "./mongo";
import { fileStore } from "./file";

/**
 * Backend selection for the data access layer: MongoDB when MONGODB_URI is
 * set, otherwise the JSON file fallback. Collection modules call store() per
 * operation and never know which backend they run on.
 */

/**
 * Return the process-wide store instance. Cached on globalThis (intentional
 * singleton: Next.js dev hot-reloads re-evaluate modules, and the cache keeps
 * one backend — and one Mongo connection pool — per process). The env var is
 * read once; changing MONGODB_URI requires a server restart.
 */
export function store() {
  if (!globalThis.__magicpenStore) {
    const uri = process.env.MONGODB_URI;
    globalThis.__magicpenStore = uri ? mongoStore(uri) : fileStore();
  }
  return globalThis.__magicpenStore;
}

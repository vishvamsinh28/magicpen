import { randomUUID } from "crypto";

/**
 * Record identity helpers shared by every store backend and collection module.
 * Timestamps are ISO strings (not Date objects) so records serialize the same
 * way through Mongo and the JSON file store.
 */

/** Current time as an ISO-8601 string — the canonical timestamp format for all records. */
export const now = () => new Date().toISOString();

/** Random UUID used as the primary key (`id` / Mongo `_id`) for every record. */
export const newId = () => randomUUID();

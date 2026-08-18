"use client";

import * as Y from "yjs";

/**
 * Client half of the collaboration channel. Yjs updates commute, so the
 * transport can be dumb: batch whatever changed locally, POST it alongside the
 * last sequence number we saw, and apply whatever comes back. No WebSocket, no
 * server-side merge, and a dropped or duplicated round trip is harmless.
 */

const POLL_ACTIVE_MS = 1200;
const POLL_IDLE_MS = 5000;
// After a local edit, sync sooner so the other side sees typing quickly.
const POLL_EAGER_MS = 350;

/**
 * Create the polling sync provider for one document's Y.Doc. Returns
 * { start, claimSeed, stop, flush }; callers must stop() on unmount or the
 * poll timer and update listener leak. Remote updates are applied with origin
 * "remote" so they are never echoed back to the server.
 */
export function createCollabProvider({ documentId, ydoc, shareToken = null, onPeers, onStatus }) {
  let since = 0;
  let stopped = false;
  let timer = null;
  let inFlight = false;
  let pending = []; // local updates not yet acknowledged by a round trip
  let lastLocalAt = 0;

  const headers = { "Content-Type": "application/json" };
  if (shareToken) headers["x-share-token"] = shareToken;

  const onLocalUpdate = (update, origin) => {
    // Updates we applied from the server come back tagged; don't echo them.
    if (origin === "remote") return;
    pending.push(update);
    lastLocalAt = Date.now();
    schedule(POLL_EAGER_MS);
  };
  ydoc.on("update", onLocalUpdate);

  const schedule = (delay) => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(tick, delay);
  };

  async function tick() {
    if (stopped || inFlight) return;
    inFlight = true;

    // Take the batch before awaiting so edits made during the request are kept
    // for the next round instead of being dropped.
    const batch = pending;
    pending = [];
    const update = batch.length ? Y.mergeUpdates(batch) : null;

    try {
      const res = await fetch(`/api/documents/${documentId}/sync`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          since,
          update: update ? toB64(update) : undefined,
        }),
      });
      if (!res.ok) throw new Error(`sync failed (${res.status})`);
      const data = await res.json();

      if (Array.isArray(data.updates) && data.updates.length) {
        Y.transact(
          ydoc,
          () => {
            for (const u of data.updates) Y.applyUpdate(ydoc, fromB64(u), "remote");
          },
          "remote"
        );
      }
      since = data.seq ?? since;
      onStatus?.({ ok: true, role: data.role, seeded: data.seeded });
      onPeers?.(data.peers || []);
    } catch (e) {
      // Put the batch back so nothing is lost, and let the next tick retry.
      if (update) pending.unshift(update);
      onStatus?.({ ok: false, error: e.message });
    } finally {
      inFlight = false;
      const busy = pending.length > 0 || Date.now() - lastLocalAt < 4000;
      schedule(busy ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    }
  }

  const start = async () => {
    await tick();
  };

  // Ask the server for the exclusive right to plant this document's initial
  // content. Returns true only if this client won — the caller seeds only then,
  // so a new shared doc is never seeded by two clients at once (which would
  // duplicate every block). Also applies anything that arrived in the meantime.
  const claimSeed = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/sync`, {
        method: "POST",
        headers,
        body: JSON.stringify({ since, claimSeed: true }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (Array.isArray(data.updates) && data.updates.length) {
        Y.transact(
          ydoc,
          () => {
            for (const u of data.updates) Y.applyUpdate(ydoc, fromB64(u), "remote");
          },
          "remote"
        );
      }
      since = data.seq ?? since;
      onPeers?.(data.peers || []);
      return !!data.seedGranted;
    } catch {
      // Network/server failure — claim not granted; another client (or a
      // later retry) will seed instead.
      return false;
    }
  };

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    ydoc.off("update", onLocalUpdate);
    // Best-effort presence cleanup; the server also expires stale peers, so a
    // failure here (tab closing mid-request) only delays the peer disappearing.
    fetch(`/api/documents/${documentId}/sync`, { method: "DELETE", headers }).catch((err) =>
      console.debug("[magicpen] presence cleanup skipped:", err?.message)
    );
  };

  return { start, claimSeed, stop, flush: () => schedule(0) };
}

// Uint8Array → base64, chunked so huge updates don't blow the argument limit
// of String.fromCharCode.apply.
const toB64 = (u8) => {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

// base64 → Uint8Array (inverse of toB64).
const fromB64 = (str) => {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

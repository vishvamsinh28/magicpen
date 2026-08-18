import * as Y from "yjs";
import { DocStates, DocUpdates, Presence } from "@/lib/store";
import { resolveAccess, can, notFound } from "@/lib/access";

// The collaboration channel. Clients POST their local Yjs updates and the
// sequence number they last saw; they get back everything newer plus who else
// is in the document. Yjs updates are commutative and idempotent, so the server
// never has to resolve a conflict — which is what lets this run over ordinary
// HTTP polling instead of a WebSocket server.

const PEER_TTL_MS = 25_000;
// Past this many loose updates the tail is merged into a single snapshot, so a
// long-lived document doesn't accumulate an unbounded log.
const COMPACT_AT = 150;

const b64 = (u8) => Buffer.from(u8).toString("base64");
const fromB64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

// Live peers, deduped to one entry per actor (most recently seen row wins) so
// the avatar list never carries duplicate ids — a stray duplicate presence row
// left by an older client would otherwise render as two identical avatars.
function livePeers(rows) {
  const cutoff = Date.now() - PEER_TTL_MS;
  const byActor = new Map();
  for (const p of rows) {
    if (new Date(p.lastSeenAt).getTime() <= cutoff) continue;
    const prev = byActor.get(p.actorId);
    if (!prev || new Date(p.lastSeenAt) > new Date(prev.lastSeenAt)) byActor.set(p.actorId, p);
  }
  return [...byActor.values()].map((p) => ({
    id: p.actorId,
    name: p.name,
    color: p.color,
    role: p.role,
  }));
}

/**
 * POST /api/documents/[id]/sync — one poll of the collaboration loop.
 * Pushes the caller's update (edit role only), compacts the log past a
 * threshold, and returns everything newer than `since` plus live peers.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const access = await resolveAccess(request, id);
    if (!access) return notFound();

    const body = await request.json().catch(() => ({}));
    const since = Number(body?.since) || 0;
    const incoming = typeof body?.update === "string" ? body.update : null;

    let state = (await DocStates.get(id)) || (await DocStates.upsert(id, {}));

    // Seed claim: a client that finds the CRDT empty asks whether it may plant
    // the initial content. Exactly one caller wins, so the document is never
    // seeded twice (which would silently duplicate every block). Edit-role only.
    let seedGranted = false;
    if (body?.claimSeed === true && can(access.role, "edit")) {
      seedGranted = (await DocStates.claimSeed(id))?.won ?? false;
    }

    // Writers push first so their own change comes back in the same round trip.
    if (incoming && can(access.role, "edit")) {
      const seq = (state.seq || 0) + 1;
      await DocUpdates.add({ documentId: id, seq, update: incoming, actorId: access.actor?.id || null });
      await DocStates.upsert(id, { seq, seeded: true });
      state = { ...state, seq, seeded: true };
    }

    let updates = await DocUpdates.list(id);

    if (updates.length > COMPACT_AT) {
      const merged = Y.mergeUpdates([
        ...(state.state ? [fromB64(state.state)] : []),
        ...updates.map((u) => fromB64(u.update)),
      ]);
      await DocUpdates.clear(id);
      await DocStates.upsert(id, { state: b64(merged), stateSeq: state.seq, seq: state.seq, seeded: true });
      state = { ...state, state: b64(merged), stateSeq: state.seq };
      updates = [];
    }

    const stateSeq = state.stateSeq || 0;
    // A client behind the snapshot gets the snapshot itself, then the tail.
    const needsSnapshot = since < stateSeq && !!state.state;
    const payload = [
      ...(needsSnapshot ? [state.state] : []),
      ...updates.filter((u) => u.seq > (needsSnapshot ? stateSeq : since)).map((u) => u.update),
    ];

    if (access.actor) {
      await Presence.touch({
        documentId: id,
        actorId: access.actor.id,
        name: access.actor.name,
        color: access.actor.color,
        role: access.role,
      });
    }
    const peers = livePeers(await Presence.list(id));

    return Response.json({
      seq: state.seq || 0,
      updates: payload,
      seeded: !!state.seeded,
      seedGranted,
      role: access.role,
      peers,
    });
  } catch (err) {
    console.error("[magicpen] sync failed:", err);
    return Response.json(
      { error: { message: "Sync failed. Please try again." } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]/sync — leave the document.
 * Drops the caller's presence row immediately so avatars don't linger for
 * the full TTL; always answers ok, even for unknown callers.
 */
export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const access = await resolveAccess(request, id);
    if (access?.actor) await Presence.remove(id, access.actor.id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[magicpen] presence remove failed:", err);
    return Response.json(
      { error: { message: "Couldn't leave the document cleanly." } },
      { status: 500 }
    );
  }
}

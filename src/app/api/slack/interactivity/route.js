import { readVerified } from "@/lib/slack";

// Interactivity webhook. The bot no longer emits interactive buttons (it drives
// everything through slash commands and thread messages), so this endpoint just
// verifies and acks — kept so any stray interaction payload gets a clean 200.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/slack/interactivity — verify the signature and ack with 200.
 * Intentionally does no work: interaction payloads are legacy traffic that
 * only needs a clean acknowledgment.
 */
export async function POST(request) {
  try {
    const { ok } = await readVerified(request);
    if (!ok) return new Response("bad signature", { status: 401 });
    return new Response(null, { status: 200 });
  } catch (err) {
    console.error("[magicpen/slack] interactivity read failed:", err);
    return new Response("internal error", { status: 500 });
  }
}

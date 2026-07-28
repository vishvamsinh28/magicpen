import { readVerified } from "@/lib/slack";

// Interactivity webhook. The bot no longer emits interactive buttons (it drives
// everything through slash commands and thread messages), so this endpoint just
// verifies and acks — kept so any stray interaction payload gets a clean 200.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const { ok } = await readVerified(request);
  if (!ok) return new Response("bad signature", { status: 401 });
  return new Response(null, { status: 200 });
}

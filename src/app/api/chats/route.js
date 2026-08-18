import { Chats } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

/**
 * GET /api/chats?q=… — list the user's chats, optionally title-filtered.
 * Filtering is a case-insensitive substring match done in memory; the store
 * call itself is unfiltered so the list stays consistent with recents.
 */
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const q = new URL(request.url).searchParams.get("q")?.toLowerCase().trim();
  try {
    let chats = await Chats.list(user.id);
    if (q) chats = chats.filter((c) => (c.title || "").toLowerCase().includes(q));
    return Response.json({ chats });
  } catch (err) {
    console.error("[magicpen] chat list failed:", err);
    return Response.json(
      { error: { message: "Couldn't load your chats. Please try again." } },
      { status: 500 }
    );
  }
}

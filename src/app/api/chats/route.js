import { Chats } from "@/lib/store";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const q = new URL(request.url).searchParams.get("q")?.toLowerCase().trim();
  let chats = await Chats.list(user.id);
  if (q) chats = chats.filter((c) => c.title.toLowerCase().includes(q));
  return Response.json({ chats });
}

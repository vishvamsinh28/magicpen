import { clearSessionCookie } from "@/lib/auth";

/**
 * POST /api/auth/logout — end the session by expiring the session cookie.
 * Purely cookie-based (JWT sessions are stateless), so there is nothing to
 * revoke server-side and the handler cannot fail.
 */
export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}

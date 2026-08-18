import { Users } from "@/lib/store";
import { getUserFromRequest, unauthorized, clearSessionCookie } from "@/lib/auth";

/**
 * GET /api/auth/me — return the signed-in user for the current session.
 * Re-checks the account in the store (JWTs outlive deleted users) and clears
 * the stale cookie in the same response when the account is gone.
 */
export async function GET(request) {
  const session = await getUserFromRequest(request);
  if (!session) return unauthorized();

  try {
    // Confirm the account still exists (JWTs outlive deleted users).
    const user = await Users.get(session.id);
    if (!user) {
      return Response.json(
        { error: { message: "Sign in required", code: "unauthorized" } },
        { status: 401, headers: { "Set-Cookie": clearSessionCookie() } }
      );
    }

    return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("[magicpen] session lookup failed:", err);
    return Response.json(
      { error: { message: "Couldn't load your account. Please try again." } },
      { status: 500 }
    );
  }
}

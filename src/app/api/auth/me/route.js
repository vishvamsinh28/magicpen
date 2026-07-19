import { Users } from "@/lib/store";
import { getUserFromRequest, unauthorized, clearSessionCookie } from "@/lib/auth";

export async function GET(request) {
  const session = await getUserFromRequest(request);
  if (!session) return unauthorized();

  // Confirm the account still exists (JWTs outlive deleted users).
  const user = await Users.get(session.id);
  if (!user) {
    return Response.json(
      { error: { message: "Sign in required", code: "unauthorized" } },
      { status: 401, headers: { "Set-Cookie": clearSessionCookie() } }
    );
  }

  return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
}

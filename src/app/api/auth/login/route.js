import { Users } from "@/lib/store";
import { verifyPassword, createSessionToken, sessionCookie } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = email ? await Users.findByEmail(email) : null;
  const valid = user && (await verifyPassword(password, user.passwordHash));
  if (!valid) {
    return Response.json({ error: { message: "Invalid email or password" } }, { status: 401 });
  }

  const token = await createSessionToken(user);
  return Response.json(
    { user: { id: user.id, name: user.name, email: user.email } },
    { headers: { "Set-Cookie": sessionCookie(token) } }
  );
}

import { Users } from "@/lib/store";
import { hashPassword, createSessionToken, sessionCookie } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register — create an account and sign the new user in.
 * Duplicate emails answer 409 both on the pre-check and on the unique-index
 * race inside create, so concurrent signups can't produce two accounts.
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: { message: "Please enter a valid email address" } }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: { message: "Password must be at least 6 characters" } }, { status: 400 });
  }

  try {
    if (await Users.findByEmail(email)) {
      return Response.json(
        { error: { message: "An account with this email already exists — try signing in" } },
        { status: 409 }
      );
    }

    let user;
    try {
      user = await Users.create({
        name: name || email.split("@")[0],
        email,
        passwordHash: await hashPassword(password),
      });
    } catch (err) {
      // Unique-index race on the email column.
      console.error("[magicpen] register failed:", err);
      return Response.json(
        { error: { message: "An account with this email already exists — try signing in" } },
        { status: 409 }
      );
    }

    const token = await createSessionToken(user);
    return Response.json(
      { user: { id: user.id, name: user.name, email: user.email } },
      { status: 201, headers: { "Set-Cookie": sessionCookie(token) } }
    );
  } catch (err) {
    console.error("[magicpen] register failed:", err);
    return Response.json(
      { error: { message: "Registration failed. Please try again." } },
      { status: 500 }
    );
  }
}

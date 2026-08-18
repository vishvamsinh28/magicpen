import { promises as fs } from "fs";
import path from "path";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";

/**
 * First-party auth: passwords hashed with scrypt (Node built-in), sessions as
 * JWTs in an httpOnly cookie. No third-party auth service involved. The
 * cookie names and the "magicpen" JWT issuer are load-bearing — existing
 * sessions in the wild break if either changes.
 */

const scrypt = promisify(scryptCb);

const SESSION_COOKIE = "mp_session";
const GUEST_COOKIE = "mp_guest";
const SESSION_DAYS = 30;
const GUEST_DAYS = 90;
const SCRYPT_KEYLEN = 64;

/* ------------------------------- passwords ------------------------------- */

/** Hash a password as "scrypt$<salt>$<hex>" — the format verifyPassword parses. */
export async function hashPassword(password) {
  try {
    const salt = randomBytes(16).toString("hex");
    const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
    return `scrypt$${salt}$${derived.toString("hex")}`;
  } catch (err) {
    throw new Error(`Password hashing failed: ${err.message}`, { cause: err });
  }
}

/**
 * Constant-time check of a password against a stored "scrypt$salt$hash"
 * string. Returns false (never throws) on malformed input.
 */
export async function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
    return timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch {
    // Bad hex / wrong length in `stored` — treat as a failed match.
    return false;
  }
}

/* ------------------------------ session JWTs ------------------------------ */

// AUTH_SECRET from env; in dev we generate one once and keep it in .data/ so
// sessions survive restarts without any configuration. Cached on globalThis
// (intentional singleton) so hot reloads don't re-read the file.
async function getSecret() {
  if (globalThis.__magicpenAuthSecret) return globalThis.__magicpenAuthSecret;

  let secret = process.env.AUTH_SECRET;
  if (!secret) {
    const file = path.join(process.cwd(), ".data", "auth-secret");
    try {
      secret = (await fs.readFile(file, "utf8")).trim();
    } catch {
      // No persisted dev secret yet — mint one. Persisting is best-effort:
      // failure only means sessions won't survive a restart.
      secret = randomBytes(32).toString("hex");
      try {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, secret);
      } catch (err) {
        console.warn("[magicpen] could not persist dev auth secret:", err?.message);
      }
      console.warn(
        "[magicpen] AUTH_SECRET not set — generated a dev secret in .data/auth-secret. Set AUTH_SECRET in production."
      );
    }
  }
  globalThis.__magicpenAuthSecret = new TextEncoder().encode(secret);
  return globalThis.__magicpenAuthSecret;
}

/** Signed session JWT for a user record; subject is the user id, expires in 30 days. */
export async function createSessionToken(user) {
  return new SignJWT({ email: user.email, name: user.name || null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("magicpen")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await getSecret());
}

/** Set-Cookie value that installs a session token (httpOnly, SameSite=Lax). */
export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

/** Set-Cookie value that expires the session cookie immediately (logout). */
export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Value of the named cookie from the request's Cookie header, or null. */
function readCookie(request, wanted) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === wanted) return rest.join("=") || null;
  }
  return null;
}

/* ------------------------------- guest ids -------------------------------- */
// People who open a share link have no account. They still need a stable
// identity so their comments and presence are attributable, so they get a
// signed guest token — same secret, but a distinct claim so a guest token can
// never be mistaken for a session.

/** Signed guest JWT (kind: "guest"); subject is the guest id, expires in 90 days. */
export async function createGuestToken({ id, name }) {
  return new SignJWT({ name: name || null, kind: "guest" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuer("magicpen")
    .setIssuedAt()
    .setExpirationTime(`${GUEST_DAYS}d`)
    .sign(await getSecret());
}

/** Set-Cookie value that installs a guest token (httpOnly, SameSite=Lax). */
export function guestCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GUEST_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_DAYS * 86400}${secure}`;
}

/**
 * Guest identity from the request's guest cookie. Returns { id, name } or
 * null for missing/invalid/expired tokens — never throws.
 */
export async function getGuestFromRequest(request) {
  const token = readCookie(request, GUEST_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecret(), { issuer: "magicpen" });
    if (!payload.sub || payload.kind !== "guest") return null;
    return { id: payload.sub, name: payload.name || null };
  } catch {
    // Expired/tampered token — same as no token.
    return null;
  }
}

/**
 * Signed-in user from the request's session cookie. Returns { id, email,
 * name } or null when the request has no valid session — never throws.
 */
export async function getUserFromRequest(request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecret(), { issuer: "magicpen" });
    if (!payload.sub) return null;
    return { id: payload.sub, email: payload.email || null, name: payload.name || null };
  } catch {
    // Expired/tampered token — same as no session.
    return null;
  }
}

/** 401 response in the API's standard error envelope. */
export function unauthorized() {
  return Response.json(
    { error: { message: "Sign in required", code: "unauthorized" } },
    { status: 401 }
  );
}

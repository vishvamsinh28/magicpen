import { promises as fs } from "fs";
import path from "path";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";

// First-party auth: passwords hashed with scrypt (Node built-in), sessions as
// JWTs in an httpOnly cookie. No third-party auth service involved.

const scrypt = promisify(scryptCb);

export const SESSION_COOKIE = "superdocs_session";
export const GUEST_COOKIE = "superdocs_guest";
const SESSION_DAYS = 30;
const GUEST_DAYS = 90;
const SCRYPT_KEYLEN = 64;

/* ------------------------------- passwords ------------------------------- */

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
    return timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

/* ------------------------------ session JWTs ------------------------------ */

// AUTH_SECRET from env; in dev we generate one once and keep it in .data/ so
// sessions survive restarts without any configuration.
async function getSecret() {
  if (globalThis.__superdocsAuthSecret) return globalThis.__superdocsAuthSecret;

  let secret = process.env.AUTH_SECRET;
  if (!secret) {
    const file = path.join(process.cwd(), ".data", "auth-secret");
    try {
      secret = (await fs.readFile(file, "utf8")).trim();
    } catch {
      secret = randomBytes(32).toString("hex");
      await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => {});
      await fs.writeFile(file, secret).catch(() => {});
      console.warn(
        "[superdocs] AUTH_SECRET not set — generated a dev secret in .data/auth-secret. Set AUTH_SECRET in production."
      );
    }
  }
  globalThis.__superdocsAuthSecret = new TextEncoder().encode(secret);
  return globalThis.__superdocsAuthSecret;
}

export async function createSessionToken(user) {
  return new SignJWT({ email: user.email, name: user.name || null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("superdocs")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await getSecret());
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(request, wanted) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === wanted) return rest.join("=") || null;
  }
  return null;
}

const readSessionCookie = (request) => readCookie(request, SESSION_COOKIE);

/* ------------------------------- guest ids -------------------------------- */
// People who open a share link have no account. They still need a stable
// identity so their comments and presence are attributable, so they get a
// signed guest token — same secret, but a distinct claim so a guest token can
// never be mistaken for a session.

export async function createGuestToken({ id, name }) {
  return new SignJWT({ name: name || null, kind: "guest" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuer("superdocs")
    .setIssuedAt()
    .setExpirationTime(`${GUEST_DAYS}d`)
    .sign(await getSecret());
}

export function guestCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GUEST_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_DAYS * 86400}${secure}`;
}

export async function getGuestFromRequest(request) {
  const token = readCookie(request, GUEST_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecret(), { issuer: "superdocs" });
    if (!payload.sub || payload.kind !== "guest") return null;
    return { id: payload.sub, name: payload.name || null };
  } catch {
    return null;
  }
}

// Returns { id, email, name } or null when the request has no valid session.
export async function getUserFromRequest(request) {
  const token = readSessionCookie(request);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecret(), { issuer: "superdocs" });
    if (!payload.sub) return null;
    return { id: payload.sub, email: payload.email || null, name: payload.name || null };
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json(
    { error: { message: "Sign in required", code: "unauthorized" } },
    { status: 401 }
  );
}

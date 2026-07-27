import { randomUUID } from "crypto";
import { Documents, Shares } from "@/lib/store";
import {
  getUserFromRequest, getGuestFromRequest, createGuestToken, guestCookie,
} from "@/lib/auth";
import { colorFor } from "@/lib/access";

// Public entry point for a share link. Resolves the token, hands back the
// document, and gives anonymous visitors a stable signed guest identity so
// their comments and presence are attributable across reloads.

async function identify(request) {
  const user = await getUserFromRequest(request);
  if (user) {
    return {
      actor: {
        id: user.id,
        name: user.name || user.email || "Someone",
        kind: "user",
        color: colorFor(user.id),
      },
      setCookie: null,
    };
  }
  const guest = await getGuestFromRequest(request);
  if (guest) {
    return {
      actor: { id: guest.id, name: guest.name || "Guest", kind: "guest", color: colorFor(guest.id) },
      setCookie: null,
    };
  }
  const id = randomUUID();
  return {
    actor: { id, name: null, kind: "guest", color: colorFor(id) },
    setCookie: guestCookie(await createGuestToken({ id, name: null })),
  };
}

const gone = (message) =>
  Response.json({ error: { message, code: "share_invalid" } }, { status: 404 });

export async function GET(request, { params }) {
  const { token } = await params;
  const share = await Shares.getByToken(token);
  if (!share || share.revoked) return gone("This link is no longer active.");

  const document = await Documents.get(share.documentId, share.ownerId);
  if (!document) return gone("The shared document no longer exists.");

  const { actor, setCookie } = await identify(request);
  const body = {
    document: {
      id: document.id,
      title: document.title,
      contentHtml: document.contentHtml || "",
      updatedAt: document.updatedAt,
    },
    role: share.role,
    allowDownload: share.allowDownload !== false,
    actor,
  };
  const headers = setCookie ? { "Set-Cookie": setCookie } : undefined;
  return Response.json(body, { headers });
}

// Guests naming themselves ("Ada") so their comments aren't all "Guest".
export async function PATCH(request, { params }) {
  const { token } = await params;
  const share = await Shares.getByToken(token);
  if (!share || share.revoked) return gone("This link is no longer active.");

  const user = await getUserFromRequest(request);
  if (user) return Response.json({ ok: true }); // signed-in names come from the account

  const { name } = await request.json().catch(() => ({}));
  const clean = String(name || "").trim().slice(0, 60);
  if (!clean) return Response.json({ error: { message: "Name is required" } }, { status: 400 });

  const guest = await getGuestFromRequest(request);
  const id = guest?.id || randomUUID();
  const cookie = guestCookie(await createGuestToken({ id, name: clean }));
  return Response.json(
    { actor: { id, name: clean, kind: "guest", color: colorFor(id) } },
    { headers: { "Set-Cookie": cookie } }
  );
}

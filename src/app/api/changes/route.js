import { Changes, Documents } from "@/lib/store";
import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

// Change history for the review panel: each record is one AI edit (summary,
// ops, and before/after HTML snapshots) tied to a document.

const VALID_STATUSES = ["applied", "pending", "rejected", "restored"];

/**
 * GET /api/changes?documentId=… — list the change history for a document.
 * A missing documentId returns an empty list rather than an error, so the
 * panel can render before a document is selected.
 */
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) return Response.json({ changes: [] });

  try {
    const changes = await Changes.list(documentId, user.id);
    return Response.json({ changes });
  } catch (err) {
    console.error("[magicpen] change list failed:", err);
    return Response.json(
      { error: { message: "Couldn't load the change history. Please try again." } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/changes — record an AI edit against a document the user owns.
 * Both HTML snapshots are re-sanitized on the way in; the summary is capped
 * and unknown statuses fall back to "applied".
 */
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { documentId, chatId = null, summary, ops = [], beforeHtml = "", afterHtml = "", status = "applied" } = body ?? {};

  if (!documentId || !summary) {
    return Response.json({ error: { message: "documentId and summary are required" } }, { status: 400 });
  }

  try {
    const document = await Documents.get(documentId, user.id);
    if (!document) {
      return Response.json({ error: { message: "Document not found" } }, { status: 404 });
    }

    const change = await Changes.add({
      userId: user.id,
      documentId,
      chatId,
      summary: String(summary).slice(0, 300),
      ops,
      beforeHtml: cleanDocHtml(beforeHtml),
      afterHtml: cleanDocHtml(afterHtml),
      status: VALID_STATUSES.includes(status) ? status : "applied",
    });
    return Response.json({ change }, { status: 201 });
  } catch (err) {
    console.error("[magicpen] change save failed:", err);
    return Response.json(
      { error: { message: "Couldn't save the change. Please try again." } },
      { status: 500 }
    );
  }
}

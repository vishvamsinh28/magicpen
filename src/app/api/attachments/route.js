import { parseFileToHtml, MAX_UPLOAD_BYTES } from "@/lib/parse";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

// Parses a chat attachment to plain text used as AI context. Nothing is stored.

/**
 * POST /api/attachments — parse an uploaded file into plain text for the chat.
 * The file is read once, converted, and discarded; only the extracted text is
 * returned. Rejects missing files (400), oversized files (413), unreadable ones (415).
 */
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: { message: "No file provided" } }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: { message: "File is larger than 30 MB" } }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFileToHtml({ buffer, filename: file.name });
    return Response.json({ attachment: { name: file.name, text: parsed?.text } });
  } catch (err) {
    console.error("[magicpen] attachment parse failed:", err);
    const message =
      err?.code === "unsupported_type" ? err.message : `Couldn't read "${file.name}".`;
    return Response.json({ error: { message } }, { status: 415 });
  }
}

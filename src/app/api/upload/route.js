import { Documents } from "@/lib/store";
import { parseFileToHtml, MAX_UPLOAD_BYTES } from "@/lib/parse";
import { uploadOriginalFile } from "@/lib/storage";
import { getUserFromRequest, unauthorized } from "@/lib/auth";

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

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseFileToHtml({ buffer, filename: file.name });
  } catch (err) {
    console.error("[superdocs] parse failed:", err);
    if (err.code === "ai_quota") {
      return Response.json({ error: { message: err.message, code: err.code } }, { status: 429 });
    }
    if (err.code === "empty_pdf" || err.code === "unsupported_type") {
      return Response.json({ error: { message: err.message, code: err.code } }, { status: 422 });
    }
    return Response.json(
      { error: { message: `Couldn't read "${file.name}". The file may be corrupted or password-protected.` } },
      { status: 415 }
    );
  }

  if (!parsed.html.replace(/<[^>]+>/g, "").trim() && !/<img /.test(parsed.html)) {
    return Response.json(
      { error: { message: "No content could be extracted from this file." } },
      { status: 422 }
    );
  }

  let document = await Documents.create({
    userId: user.id,
    title: parsed.title,
    contentHtml: parsed.html,
    sourceFile: { name: file.name, type: file.type, size: file.size },
  });

  // Archive the original in a private Supabase Storage bucket when configured
  // (server-side only; non-blocking on failure).
  const stored = await uploadOriginalFile({
    buffer,
    path: `${user.id}/${document.id}/${file.name.replace(/[^\w.\-() ]/g, "_")}`,
    contentType: file.type || "application/octet-stream",
  });
  if (stored) {
    document = await Documents.update(document.id, user.id, {
      sourceFile: { ...document.sourceFile, storage: stored },
    });
  }

  return Response.json({ document }, { status: 201 });
}

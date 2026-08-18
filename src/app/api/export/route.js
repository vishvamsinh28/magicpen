import { cleanDocHtml } from "@/lib/sanitize";
import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { resolveAccess, forbidden } from "@/lib/access";
import { exportDoc } from "@/lib/export";

function fileResponse(body, { filename, type }) {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { title = "document", format = "docx", documentId = null } = body;

  // Share visitors export through the same route, so downloads are gated by
  // the link's own "allow download" setting rather than by having an account.
  if (documentId) {
    const access = await resolveAccess(request, documentId);
    if (!access) return unauthorized();
    if (!access.allowDownload) return forbidden("Downloads are turned off for this link");
  } else if (!(await getUserFromRequest(request))) {
    return unauthorized();
  }

  const html = cleanDocHtml(body.html || "");
  if (!html) {
    return Response.json({ error: { message: "Nothing to export — the document is empty" } }, { status: 400 });
  }

  try {
    const { body: out, filename, mimetype } = await exportDoc({ html, title, format });
    return fileResponse(out, { filename, type: mimetype });
  } catch (err) {
    if (err.code === "bad_format") {
      return Response.json({ error: { message: err.message } }, { status: 400 });
    }
    console.error("[magicpen] export failed:", err);
    return Response.json({ error: { message: "Export failed. Please try again." } }, { status: 500 });
  }
}

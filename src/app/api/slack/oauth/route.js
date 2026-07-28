import { SlackInstalls } from "@/lib/store";
import { exchangeInstallCode, appBaseUrl } from "@/lib/slack";
import { escapeHtml } from "@/lib/sanitize";

// OAuth redirect target for installing the app into any workspace (public
// distribution). Slack sends the user here with ?code=… after they approve;
// we exchange it for that workspace's bot token and store it keyed by team.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlPage({ title, heading, body }) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapeHtml(title)}</title><style>` +
      `body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#f7f7f5;color:#1f1e1b;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center}` +
      `.card{background:#fff;border:1px solid #e6e4df;border-radius:14px;padding:32px 36px;max-width:440px;box-shadow:0 6px 24px rgba(0,0,0,.05)}` +
      `h1{font-size:20px;margin:0 0 10px}p{line-height:1.55;margin:8px 0;color:#4a4842}a{color:#1d63d8}` +
      `</style></head><body><div class="card"><h1>${escapeHtml(heading)}</h1>${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;

  if (params.get("error")) {
    return htmlPage({
      title: "Installation cancelled",
      heading: "Installation cancelled",
      body: `<p>The SuperDocs app was not installed. You can close this tab.</p>`,
    });
  }

  const code = params.get("code");
  if (!code) {
    return htmlPage({
      title: "Missing code",
      heading: "Something went wrong",
      body: `<p>No authorization code was provided. Please start the installation again.</p>`,
    });
  }

  try {
    const install = await exchangeInstallCode(code);
    if (!install.teamId || !install.botToken) throw new Error("incomplete install response");
    await SlackInstalls.save(install);

    return htmlPage({
      title: "SuperDocs installed",
      heading: "🎉 SuperDocs is installed",
      body:
        `<p>SuperDocs was added to <strong>${escapeHtml(install.teamName || "your workspace")}</strong>.</p>` +
        `<p>Head back to Slack, then <strong>DM the SuperDocs bot</strong> or <strong>@mention it</strong> in a channel. ` +
        `The first time, it'll ask you to connect your SuperDocs account.</p>` +
        `<p><a href="${escapeHtml(appBaseUrl())}/app">Open SuperDocs →</a></p>`,
    });
  } catch (err) {
    console.error("[superdocs/slack] install failed:", err);
    return htmlPage({
      title: "Installation failed",
      heading: "Installation failed",
      body: `<p>We couldn't complete the installation (${escapeHtml(err.code || err.message || "unknown error")}). Please try again.</p>`,
    });
  }
}

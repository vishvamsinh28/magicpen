# SuperDocs — Google Docs add-on

A Google Docs sidebar that edits the open document with AI, powered by the
SuperDocs backend. This folder is a **separate Google Apps Script project** — it
is *not* part of the Next.js build. It talks to the SuperDocs app over HTTPS.

```
Google Docs sidebar (this Apps Script)
        │  POST {APP_BASE_URL}/api/gdocs/assist   (header: X-SuperDocs-Addon)
        ▼
SuperDocs backend (Next.js)  ── runAssistant (Gemini) ── returns edited HTML
```

**Selection-first:** if you have text selected, only those paragraphs are edited;
otherwise the whole document is. v1 is text-level — bold/italic/colour on runs is
not preserved across an edit.

## Files

| File | Role |
|------|------|
| `Code.gs` | server-side add-on logic: menu, sidebar, doc read/write, backend calls |
| `Sidebar.html` | the sidebar UI (instruction box + results) |
| `appsscript.json` | manifest + OAuth scopes |

## Prerequisites

- The SuperDocs backend deployed and reachable at a public HTTPS URL
  (`APP_BASE_URL`), with `GDOCS_ADDON_SECRET` set in its environment. In local
  dev, expose it with a tunnel (e.g. `ngrok http 3000`) — Google can't reach
  `localhost`.
- [clasp](https://github.com/google/clasp): `npm install -g @google/clasp` then
  `clasp login`.

## Deploy (test add-on, single workspace)

1. **Create the Apps Script project and push this code:**
   ```bash
   cd google-addon
   clasp create --title "SuperDocs" --type docs
   # copy the printed scriptId into .clasp.json (see .clasp.json.example)
   clasp push
   ```
   (Or create it manually at https://script.google.com and paste each file.)

2. **Configure it.** In the Apps Script editor: **Project Settings → Script
   Properties → Add**, and set both:
   - `APP_BASE_URL` = your SuperDocs origin, no trailing slash (e.g. the ngrok URL)
   - `GDOCS_ADDON_SECRET` = the **same** value as the backend's `GDOCS_ADDON_SECRET`

   (Or run `setConfig("https://your-url", "your-secret")` once from the editor.)

3. **Install it for yourself.** In the editor: **Deploy → Test deployments →
   Install** (Editor Add-on). Open any Google Doc → **Extensions → SuperDocs →
   Open SuperDocs**.

## Sharing with a small team (personal Gmail, no Google review)

You don't need the public Marketplace to let a handful of people use this:

1. In the Apps Script editor, **Share** the script project (top-right, like a
   Google Doc) with each teammate's Google account as an **Editor**.
2. Each teammate opens the script, then **Deploy → Test deployments → Install**
   for their own account. They now get **Extensions → SuperDocs** in their Docs.
3. On first use each person clicks **Connect SuperDocs** and links their own
   SuperDocs account — after that it just works for them.

Everyone shares the same backend (`APP_BASE_URL` + `GDOCS_ADDON_SECRET` live in
the one script's Script Properties, not per-user). Identity is read from each
user's signed OpenID token, so linking works across different Gmail accounts —
not just the owner's.

> Reaching **everyone in a company** without per-person installs, or a **public**
> listing, needs the Google Workspace Marketplace (Internal = a managed Workspace
> domain, no review; Public = OAuth verification + review). Not required for a
> small team.

## First run: connect your account

The first edit shows a **Connect SuperDocs** link. Open it, sign in to your
SuperDocs account, and confirm — this maps your Google email to your SuperDocs
account (stored server-side in `GoogleLinks`). After that, edits just work.

## OAuth scopes (why each is requested)

- `documents.currentonly` — read/write the doc you're in (narrow: only the active doc).
- `script.external_request` — call the SuperDocs backend.
- `userinfo.email` + `openid` — identify the running user via a signed OpenID
  token (reliable across different Gmail accounts, to link SuperDocs accounts).
- `script.container.ui` — show the sidebar.

## Notes / limits (v1)

- Text-level fidelity only; run formatting isn't round-tripped.
- Stateless — no follow-up memory, versions, or undo yet (the doc is the source
  of truth). Those would need the add-on to bind the doc to a SuperDocs
  `Documents`/`Chat` record, mirroring the Slack thread model.
- Replacing a selection that spans list items or table cells falls back to plain
  paragraphs.

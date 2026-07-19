# SuperDocs

AI-powered document editing. Upload a document (or create one from chat), tell the
assistant what to change in plain English, and it edits **in place** — only the relevant
blocks are touched, so headings, tables, links, and formatting survive.

Built with Next.js 16 (App Router), TipTap, Google Gemini (`gemini-3.1-flash-lite`), and
MongoDB. Auth is first-party (scrypt password hashing + JWT sessions); Supabase is used
**only** for file storage.

## Features

- ✍️ **AI editing inside the document** — the model returns block-level edit operations
  (replace / insert / delete), never a full regeneration
- 🔐 **Accounts** — email/password auth with scrypt-hashed passwords stored in your DB
  and JWT sessions in an httpOnly cookie; every document, chat, and change is private
  to the signed-in user
- 📄 **Import**: PDF, DOCX, TXT, RTF, Markdown, HTML (≤ 30 MB)
- 📥 **Export**: Word (.docx), Markdown, HTML, plain text, or print-to-PDF
- 📎 **Reference attachments** in chat for extra context
- 📝 **Templates**: NDA, rent agreement, cover letter, meeting notes, proposal, invoice, resume
- 🛡️ **Review Mode**: approve or dismiss proposed changes before they land
- 🔄 **Changes history** per document with one-click restore
- 💬 **Chat history**, multi-document tabs, zoom, mobile-responsive layout

## Pages

| Route | What it is |
| --- | --- |
| `/` | Landing page |
| `/login` · `/register` | Email/password auth |
| `/app` | The workspace — chat on the left, editor on the right |

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your values
npm run dev
```

Open http://localhost:3000 and create an account — registration works immediately,
even with an empty `.env.local` (see fallbacks below).

### Environment (`.env.example`)

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini key (aistudio.google.com/apikey) — powers the assistant |
| `GEMINI_MODEL` | Optional — defaults to `gemini-3.1-flash-lite`, the single model SuperDocs uses (set e.g. `gemini-3.5-flash` for top quality; its free tier is only ~20 requests/day) |
| `AUTH_SECRET` | Signs session JWTs (`openssl rand -hex 32`). **Required in production**; auto-generated into `.data/auth-secret` in dev |
| `MONGODB_URI`, `MONGODB_DB` | MongoDB connection — stores users, documents, chats, changes; **if unset, a local JSON store in `.data/` is used (dev only)** |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Optional, storage only — archives original uploads in a private bucket, server-side |
| `SUPABASE_STORAGE_BUCKET` | Bucket name (default `superdocs`, auto-created) |
| `MOCK_AI=1` | Try the whole app with canned AI responses, no key needed |

Everything degrades gracefully: without MongoDB you get a JSON file store, without
Supabase uploads simply aren't archived, and without a Gemini key the chat tells you
exactly what's missing (or set `MOCK_AI=1`).

## How auth works

- **Register/login** at `/register` and `/login` → `POST /api/auth/register|login`.
- Passwords are hashed with Node's built-in **scrypt** (random salt, timing-safe
  comparison) and stored on the user record in your database — no auth provider.
- Sessions are **HS256 JWTs** (30 days) signed with `AUTH_SECRET` and delivered as an
  `httpOnly; SameSite=Lax` cookie, so tokens never touch JavaScript or localStorage.
- Every API route verifies the cookie and scopes queries by the token's user id.
  `GET /api/auth/me` hydrates the client; `POST /api/auth/logout` clears the cookie.

## Storage (Supabase, optional)

Original uploads are archived to a **private** bucket at
`<user id>/<document id>/<filename>`, purely server-side via the secret key
(`sb_secret_...`). The key never reaches the browser and the bucket needs no RLS
policies or public access. Skip the env vars and the app just doesn't archive.

## How AI editing works

1. The editor document is serialized into numbered top-level HTML blocks.
2. Gemini receives the blocks + your request and returns JSON edit operations
   (`replace`, `insertAfter`, `insertBefore`, `delete`, `setDocument`) plus a short reply.
3. Operations are applied as a pure HTML transform — untouched blocks are preserved
   byte-for-byte — then sanitized, saved, and recorded in the Changes history.

## Scripts

- `npm run dev` — development server (Turbopack)
- `npm run build` / `npm start` — production build & serve

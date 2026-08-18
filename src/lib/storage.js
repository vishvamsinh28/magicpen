/**
 * Supabase Storage archive for original uploaded files — the ONLY thing
 * Supabase is used for. Server-side only, using the secret key; the bucket
 * stays private and is never touched from the browser. Optional: when the env
 * vars are missing the app still works, it just skips archiving — which is why
 * every function here degrades to a no-op instead of throwing.
 */

/** Supabase settings from env, or null when archiving is not configured. */
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url, key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "magicpen" };
}

// Client cached on globalThis (intentional singleton: survives Next.js dev
// hot reloads so each process keeps one Supabase client).
async function client() {
  const cfg = config();
  if (!cfg) return null;
  if (!globalThis.__magicpenSupabase) {
    const { createClient } = await import("@supabase/supabase-js");
    globalThis.__magicpenSupabase = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false },
    });
  }
  return globalThis.__magicpenSupabase;
}

/**
 * Delete an archived original from the bucket. Best-effort: failures are
 * logged and swallowed so document deletion never blocks on storage.
 */
export async function removeStoredFile(path) {
  const cfg = config();
  if (!cfg || !path) return;
  try {
    const supabase = await client();
    await supabase.storage.from(cfg.bucket).remove([path]);
  } catch (err) {
    console.warn("[magicpen] Supabase delete skipped:", err.message);
  }
}

/**
 * Archive an uploaded file's original bytes at `path` in the private bucket.
 * Returns { bucket, path } on success or null when archiving is off or fails —
 * uploads must succeed for the user either way, so this never throws.
 */
export async function uploadOriginalFile({ buffer, path, contentType }) {
  const cfg = config();
  if (!cfg) return null;
  try {
    const supabase = await client();

    const doUpload = () =>
      supabase.storage.from(cfg.bucket).upload(path, buffer, { contentType, upsert: true });

    let { error } = await doUpload();
    if (error && /bucket not found/i.test(error.message || "")) {
      // First upload ever: create the bucket, then retry once. A create
      // failure (e.g. racing another instance) still warrants the retry.
      await supabase.storage
        .createBucket(cfg.bucket, { public: false })
        .catch((err) => console.warn("[magicpen] Supabase bucket create failed:", err?.message));
      ({ error } = await doUpload());
    }
    if (error) {
      console.warn("[magicpen] Supabase upload skipped:", error.message);
      return null;
    }
    return { bucket: cfg.bucket, path };
  } catch (err) {
    console.warn("[magicpen] Supabase upload skipped:", err.message);
    return null;
  }
}

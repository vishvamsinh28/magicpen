// Supabase Storage archive for original uploaded files — the ONLY thing
// Supabase is used for. Server-side only, using the secret key; the bucket
// stays private and is never touched from the browser. Optional: when the env
// vars are missing the app still works, it just skips archiving.

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url, key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "superdocs" };
}

async function client() {
  const cfg = config();
  if (!cfg) return null;
  if (!globalThis.__superdocsSupabase) {
    const { createClient } = await import("@supabase/supabase-js");
    globalThis.__superdocsSupabase = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false },
    });
  }
  return globalThis.__superdocsSupabase;
}

export async function removeStoredFile(path) {
  const cfg = config();
  if (!cfg || !path) return;
  try {
    const supabase = await client();
    await supabase.storage.from(cfg.bucket).remove([path]);
  } catch (err) {
    console.warn("[superdocs] Supabase delete skipped:", err.message);
  }
}

export async function uploadOriginalFile({ buffer, path, contentType }) {
  const cfg = config();
  try {
    const supabase = await client();
    if (!supabase) return null;

    const doUpload = () =>
      supabase.storage.from(cfg.bucket).upload(path, buffer, { contentType, upsert: true });

    let { error } = await doUpload();
    if (error && /bucket not found/i.test(error.message || "")) {
      await supabase.storage.createBucket(cfg.bucket, { public: false }).catch(() => {});
      ({ error } = await doUpload());
    }
    if (error) {
      console.warn("[superdocs] Supabase upload skipped:", error.message);
      return null;
    }
    return { bucket: cfg.bucket, path };
  } catch (err) {
    console.warn("[superdocs] Supabase upload skipped:", err.message);
    return null;
  }
}

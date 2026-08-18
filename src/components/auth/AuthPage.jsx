"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { apiFetch } from "@/lib/client-utils";

/**
 * Labeled form input. With `password` it renders as a password field with a
 * show/hide toggle (overriding `type`); all fields are required by default.
 */
function Field({ label, type = "text", value, onChange, placeholder, autoComplete, autoFocus, minLength, password = false }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>
      <span className="relative block">
        <input
          type={password ? (show ? "text" : "password") : type}
          required
          minLength={minLength}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border-[1.5px] border-line-strong bg-paper py-2.5 pl-3.5 text-[14px] text-ink outline-none transition-shadow placeholder:text-muted focus:shadow-card ${
            password ? "pr-11" : "pr-3.5"
          }`}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            title={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </span>
    </label>
  );
}

/**
 * Sign-in / registration form (`mode` picks which). Submission errors surface
 * inline below the fields; an already-authenticated visitor is bounced
 * straight to /app.
 */
export default function AuthPage({ mode = "login" }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Already signed in? Straight to the app.
  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(() => router.replace("/app"))
      .catch(() => {
        // A 401 is the expected answer for a signed-out visitor — stay on the
        // form; surfacing it would show an error on every fresh page load.
      });
  }, [router]);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(
          isRegister ? { name, email, password } : { email, password }
        ),
      });
      // Success: keep the spinner running through the client-side redirect.
      router.push("/app");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to home
        </Link>

        <div className="rounded-2xl border-[1.5px] border-line-strong bg-paper p-8 shadow-card">
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <div>
              <h1 className="font-display text-[22px] font-bold leading-tight tracking-tight text-ink">
                {isRegister ? "Create your account" : "Welcome back"}
              </h1>
              <p className="text-[13px] text-muted">
                {isRegister
                  ? "Your documents stay private to your account."
                  : "Sign in to get back to your documents."}
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {isRegister && (
              <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" autoComplete="name" autoFocus />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus={!isRegister}
            />
            <Field
              label="Password"
              password
              value={password}
              onChange={setPassword}
              placeholder={isRegister ? "At least 6 characters" : "Your password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 6 : undefined}
            />

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-snug text-red-800">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[14.5px] font-semibold text-white shadow-card transition-colors hover:bg-accent-deep disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 border-t border-line pt-4 text-center text-[13px] text-muted">
            {isRegister ? (
              <>Already have an account? <Link href="/login" className="font-semibold text-accent-deep hover:underline">Sign in</Link></>
            ) : (
              <>New to MagicPen? <Link href="/register" className="font-semibold text-accent-deep hover:underline">Create an account</Link></>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

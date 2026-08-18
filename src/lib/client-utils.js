"use client";

/**
 * Small browser-side utilities shared across components: relative timestamps,
 * blob downloads, title derivation, and the authenticated fetch wrapper.
 */

/** Compact relative time ("just now", "5m ago", …) falling back to a short date. */
export function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Trigger a browser download of a Blob via a temporary object URL. The URL is
 * revoked shortly after the click so the download can start first.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Derive a document title from the first heading/paragraph of its HTML —
 * "Untitled document" is boring. Falls back to that default for empty content.
 */
export function deriveTitleFromHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  const first = div.querySelector("h1, h2, h3, p");
  const text = (first?.textContent || div.textContent || "").trim().replace(/\s+/g, " ");
  return text ? text.slice(0, 64) : "Untitled document";
}

/**
 * Fetch wrapper for the app's API. The session lives in an httpOnly cookie,
 * so same-origin fetches are authenticated automatically. Returns the parsed
 * JSON body (or null for non-JSON responses) and THROWS on any non-OK status
 * — components rely on catching that error to show toasts. An expired session
 * (401) bounces to /login — except for the auth endpoints themselves, where
 * 401 is a real answer.
 */
export async function apiFetch(url, options = {}) {
  const headers = {
    // FormData bodies must set their own multipart boundary header.
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    window.location.assign("/login");
    throw new Error("Sign in required");
  }

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  // A malformed JSON body is treated as no body — the status-based error below
  // still fires with its fallback message.
  if (contentType.includes("application/json")) data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
}

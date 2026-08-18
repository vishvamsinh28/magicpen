import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import { getUserFromRequest } from "@/lib/auth";

export const metadata = {
  title: "MagicPen — Edit documents with AI, in place",
  description:
    "Upload a document, ask in plain English, and MagicPen edits only what you ask for — formatting, tables, and footnotes survive. Work on it from Slack or Google Docs, share a live link, commit versions, and leave with a real file.",
};

/**
 * / — the marketing landing page.
 * Signed-in visitors are redirected straight to /app; the redirect() call
 * must stay outside any try/catch, since it works by throwing.
 */
export default async function Home() {
  // Signed-in users have no use for the marketing page — send them straight to
  // their workspace. Reuse the session verification from the API layer by
  // adapting the cookie store to the request shape getUserFromRequest expects.
  const cookieStore = await cookies();
  const user = await getUserFromRequest({
    headers: { get: (name) => (name === "cookie" ? cookieStore.toString() : null) },
  });
  if (user) redirect("/app");

  return <LandingPage />;
}

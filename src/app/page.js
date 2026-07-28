import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import { getUserFromRequest } from "@/lib/auth";

export const metadata = {
  title: "SuperDocs — Edit documents with AI, in place",
  description:
    "Upload a PDF or Word file, ask in plain English, and SuperDocs edits only what you ask for — formatting, tables, and footnotes survive. Export back to Word when you're done.",
};

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

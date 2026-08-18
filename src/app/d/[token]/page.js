import SharedDoc from "@/components/collab/SharedDoc";

export const metadata = {
  title: "Shared document — MagicPen",
  // A share link is a capability; keep it out of search indexes.
  robots: { index: false, follow: false },
};

/**
 * /d/[token] — viewer for a shared document link.
 * Only unwraps the async route params; token validation and access control
 * happen in SharedDoc via /api/share/[token].
 */
export default async function SharedDocumentPage({ params }) {
  const { token } = await params;
  return <SharedDoc token={token} />;
}

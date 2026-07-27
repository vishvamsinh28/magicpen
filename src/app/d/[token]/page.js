import SharedDoc from "@/components/collab/SharedDoc";

export const metadata = {
  title: "Shared document — SuperDocs",
  // A share link is a capability; keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function SharedDocumentPage({ params }) {
  const { token } = await params;
  return <SharedDoc token={token} />;
}

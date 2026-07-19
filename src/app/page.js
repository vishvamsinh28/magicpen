import LandingPage from "@/components/landing/LandingPage";

export const metadata = {
  title: "SuperDocs — Edit documents with AI, in place",
  description:
    "Upload a PDF or Word file, ask in plain English, and SuperDocs edits only what you ask for — formatting, tables, and footnotes survive. Export back to Word when you're done.",
};

export default function Home() {
  return <LandingPage />;
}

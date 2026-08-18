import { Roboto, Roboto_Mono, Bricolage_Grotesque } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Roboto matches the Google Docs chrome the workspace is styled after.
const roboto = Roboto({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata = {
  title: "MagicPen — AI document editor",
  description:
    "Write and edit documents with AI. Open a document, ask in plain English, and MagicPen makes precise edits right in place — your formatting stays exactly as you left it.",
};

/**
 * Root layout for every route: wires the three font CSS variables that
 * globals.css maps to --font-sans/--font-mono/--font-display, and mounts
 * Vercel Analytics once for the whole app.
 */
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${robotoMono.variable} ${bricolage.variable} min-h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

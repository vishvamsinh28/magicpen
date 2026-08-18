/**
 * MagicPen marketing landing page (a server component: keep it free of hooks
 * and "use client"). Purely compositional: each section lives in a sibling
 * module in this folder, and this file only fixes the page order inside the
 * shared <main> shell.
 */

import { Hero, IntegrationsStrip, SiteHeader } from "./Masthead";
import { ShowcaseSections } from "./Showcases";
import { CtaSection, SiteFooter, SpecIndex } from "./Closing";

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />
      <Hero />
      <IntegrationsStrip />
      <ShowcaseSections />
      <SpecIndex />
      <CtaSection />
      <SiteFooter />
    </main>
  );
}

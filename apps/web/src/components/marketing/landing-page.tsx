"use client";

import { LandingAppBanner } from "@/components/marketing/landing-app-banner";
import { LandingNav } from "@/components/marketing/landing-nav";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingFutureSnapshot } from "@/components/marketing/landing-future-snapshot";
import { LandingHomepageBody } from "@/components/marketing/landing-homepage-body";
import { LandingFooter } from "@/components/marketing/landing-footer";

/**
 * Marketing homepage — Master Brief composition.
 * Hero → Future Snapshot (holy moment) → Twin story → dashboard wow → features → ask → privacy → pricing → CTA.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-forward-50 text-forward-900">
      <LandingAppBanner />
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFutureSnapshot />
        <LandingHomepageBody />
      </main>
      <LandingFooter />
    </div>
  );
}

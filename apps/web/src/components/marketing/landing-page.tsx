import { LandingAppBanner } from "@/components/marketing/landing-app-banner";
import { LandingNav } from "@/components/marketing/landing-nav";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingFutureSnapshot } from "@/components/marketing/landing-future-snapshot";
import { LandingHomepageBody } from "@/components/marketing/landing-homepage-body";
import { LandingFooter } from "@/components/marketing/landing-footer";

/**
 * Marketing homepage — refined Life Pulse composition.
 * Hero demo → Today snapshot → Life OS → Connected intelligence → Twin → LifeVue → Privacy → Pricing → CTA.
 */
export function LandingPage() {
  return (
    <div className="ml-home min-h-screen">
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

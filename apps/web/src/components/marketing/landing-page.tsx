import { LandingCta } from "./landing-cta";
import { LandingFeatures } from "./landing-features";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingHowItWorks } from "./landing-how-it-works";
import { LandingModules } from "./landing-modules";
import { LandingNav } from "./landing-nav";
import { LandingPricing } from "./landing-pricing";
import { LandingTrustBar } from "./landing-trust-bar";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <LandingHero />
      <LandingTrustBar />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingModules />
      <LandingPricing />
      <LandingCta />
      <LandingFooter />
    </div>
  );
}

import { LandingAppBanner } from "./landing-app-banner";
import { LandingAiBrain } from "./landing-ai-brain";
import { LandingConnectedLife } from "./landing-connected-life";
import { LandingCta } from "./landing-cta";
import { LandingDigitalTwin } from "./landing-digital-twin";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingLifeFeed } from "./landing-life-feed";
import { LandingLifeScale } from "./landing-life-scale";
import { LandingNav } from "./landing-nav";
import { LandingPredictions } from "./landing-predictions";
import { LandingPricing } from "./landing-pricing";
import { LandingSocialProof } from "./landing-social-proof";
import { LandingTestimonials } from "./landing-testimonials";
import { LandingTrustSection } from "./landing-trust-section";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingAppBanner />
      <LandingNav />
      <LandingHero />
      <LandingDigitalTwin />
      <LandingLifeScale />
      <LandingConnectedLife />
      <LandingAiBrain />
      <LandingPredictions />
      <LandingTrustSection />
      <LandingSocialProof />
      <LandingTestimonials />
      <LandingLifeFeed />
      <LandingPricing />
      <LandingCta />
      <LandingFooter />
    </div>
  );
}

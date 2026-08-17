import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClassName } from "@/components/button";
import {
  FINAL_CTA_BUTTON,
  FINAL_CTA_HEADLINE,
  FINAL_CTA_SUBHEAD,
} from "@/lib/marketing-copy";
import { FEATURED_BLOG_LINKS } from "@/lib/blog-content";
import { MarketingPricingSection } from "@/components/marketing/marketing-pricing-section";
import { LandingDemoVideo } from "./landing-demo-video";
import { LandingDigitalTwinSection } from "./landing-digital-twin-section";
import { LandingLifeOsHub } from "./landing-life-os-hub";
import { LandingLifePulseStory } from "./landing-life-pulse-story";
import { LandingLifeVueRing } from "./landing-lifevue-ring";
import { LandingMarketingPrivacy } from "./landing-marketing-privacy";

export function LandingFinalCta() {
  return (
    <section className="landing-hero-bg py-24 text-white">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          {FINAL_CTA_HEADLINE}
        </h2>
        <p className="mt-5 text-lg text-[#98A5B7]">{FINAL_CTA_SUBHEAD}</p>
        <Link href="/register" className={buttonClassName({ size: "lg", className: "mt-10" })}>
          {FINAL_CTA_BUTTON}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function LandingDemoAnchor() {
  return (
    <section id="demo" className="scroll-mt-24 bg-[#0D1420] py-16 text-white">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Product demo</h2>
        <p className="mt-3 text-[#98A5B7]">
          45 seconds — voice, daily brief, and Life Graph.
        </p>
        <div className="mt-8">
          <LandingDemoVideo />
        </div>
        <p className="mt-6 text-sm text-[#98A5B7]">
          Prefer the interactive path?{" "}
          <a href="#future-snapshot" className="font-semibold text-[#67E8F9] hover:underline">
            Get a Future Snapshot in under a minute
          </a>
          .
        </p>
      </div>
    </section>
  );
}

export function LandingGuidesSeo() {
  return (
    <section id="guides" className="scroll-mt-24 border-t border-white/[0.06] bg-[#070B14] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#98A5B7]">Learn</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F7F9FC] sm:text-4xl">
              Guides & articles
            </h2>
            <p className="mt-3 max-w-xl text-[#98A5B7]">
              Practical reads on Digital Twins, AI planning, and using MotiveLife day to day.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#67E8F9] hover:underline"
          >
            All articles & guides
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURED_BLOG_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block h-full border-l-2 border-[#00E5FF]/40 py-1 pl-4 transition hover:border-[#67E8F9]"
              >
                <p className="font-semibold text-[#F7F9FC]">{item.label}</p>
                <p className="mt-1 text-sm text-[#98A5B7]">{item.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Trimmed homepage — hero + snapshot live in landing-page.tsx */
export function LandingHomepageBody() {
  return (
    <>
      <LandingLifeOsHub />
      <LandingLifePulseStory />
      <LandingDigitalTwinSection />
      <LandingLifeVueRing />
      <LandingMarketingPrivacy />
      <MarketingPricingSection variant="dark" />
      <LandingFinalCta />
      <LandingDemoAnchor />
      <LandingGuidesSeo />
    </>
  );
}

/** @deprecated Re-export for older imports */
export { LandingLifeOsHub as LandingTwoProducts } from "./landing-life-os-hub";

export function LandingPricingTiers() {
  return <MarketingPricingSection variant="dark" />;
}

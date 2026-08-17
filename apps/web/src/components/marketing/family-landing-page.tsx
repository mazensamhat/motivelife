import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClassName } from "@/components/button";
import {
  FamilyComparisonVisual,
  FamilyDriveIntelVisual,
  FamilyFlowLogisticsVisual,
  FamilyLifeImpactVisual,
  FamilyMapHeroVisual,
  FamilyNormalLifeVisual,
  FamilyOmgChangeVisual,
  FamilyPeaceOfMindVisual,
  FamilyPlaceIntelVisual,
} from "@/components/marketing/family-marketing-visuals";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingNav } from "@/components/marketing/landing-nav";
import { ModulePencilVideoPlayer } from "@/components/marketing/module-pencil-video-player";
import { MarketingPricingSection } from "@/components/marketing/marketing-pricing-section";
import { getModulePencilVideo } from "@/lib/module-pencil-videos";
import {
  FAMILY_CTA_PRIMARY,
  FAMILY_CTA_SECONDARY,
  FAMILY_HERO_LINES,
  FAMILY_INTELLIGENCE_PILLARS,
  FAMILY_MAP_PATH,
  FAMILY_NORMAL_LIFE_PUNCH,
  FAMILY_PAGE_PATH,
  FAMILY_PRICE_LABEL,
  FAMILY_PRIVACY_PILLARS,
  FAMILY_PRODUCT_NAME,
  FAMILY_PRODUCT_STATEMENT,
  FAMILY_SUPPORTING_LINE,
  FAMILY_TAGLINE,
} from "@/lib/family-marketing";

function CtaPair({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link href={FAMILY_MAP_PATH} className={buttonClassName({ size: "lg" })}>
        {FAMILY_CTA_PRIMARY}
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
      </Link>
      <Link
        href="/register?plan=family"
        className={buttonClassName({
          size: "lg",
          variant: "secondary",
          className: "border-white/20 bg-white/5 text-white hover:bg-white/10",
        })}
      >
        {FAMILY_CTA_SECONDARY}
      </Link>
    </div>
  );
}

export function FamilyLandingPage() {
  return (
    <div className="min-h-screen bg-forward-950 text-white">
      <LandingNav activeLabel="KINZO" />

      <section className="landing-hero-bg relative overflow-hidden">
        <div className="landing-hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:pb-14 sm:pt-20">
          <p className="landing-fade-up text-sm font-semibold uppercase tracking-[0.22em] text-brand-cyan">
            {FAMILY_PRODUCT_NAME} · Family Intelligence
          </p>
          <h1 className="landing-fade-up landing-fade-up-delay-1 mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            <span className="block">{FAMILY_HERO_LINES[0]}</span>
            <span className="mt-2 block text-forward-100">{FAMILY_HERO_LINES[1]}</span>
          </h1>
          <p className="landing-fade-up landing-fade-up-delay-2 mt-5 max-w-2xl text-lg text-forward-300 sm:text-xl">
            {FAMILY_TAGLINE}
          </p>
          <p className="landing-fade-up landing-fade-up-delay-2 mt-3 max-w-2xl text-base text-forward-400">
            {FAMILY_SUPPORTING_LINE}
          </p>
          <CtaPair className="landing-fade-up landing-fade-up-delay-3 mt-8" />
          <p className="mt-4 text-sm text-forward-400">
            Powered by MyMotiveLife · {FAMILY_PRICE_LABEL} · Includes Life Pro for the owner
          </p>
        </div>

        <div className="relative mx-auto max-w-6xl px-0 sm:px-4 sm:pb-10">
          <FamilyMapHeroVisual />
        </div>
      </section>

      <section id="product-video" className="scroll-mt-24 border-t border-white/10 bg-forward-950 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
            Product video
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            KINZO in under a minute
          </h2>
          <p className="mt-4 max-w-2xl text-base text-forward-300">
            Family map, calm alerts, and peace of mind without hovering.
          </p>
          <div className="mt-8">
            <ModulePencilVideoPlayer
              video={getModulePencilVideo("kinzo")!}
              paper={false}
            />
          </div>
          <p className="mt-4 text-sm text-forward-400">
            Full suite:{" "}
            <Link href="/videos" className="text-brand-cyan hover:underline">
              /videos
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 bg-forward-50 py-16 text-forward-900 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <FamilyPeaceOfMindVisual />
        </div>
      </section>

      <section className="border-t border-white/10 bg-white py-14 text-forward-900 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center font-display text-xl font-semibold tracking-tight text-forward-900 sm:text-2xl">
            {FAMILY_NORMAL_LIFE_PUNCH}
          </p>
          <div className="mt-10">
            <FamilyNormalLifeVisual />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-forward-900/40 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">
            A map tells you where they are.
          </h2>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight text-brand-cyan sm:text-4xl">
            KINZO AI understands what’s happening.
          </p>
          <p className="mt-6 text-base text-forward-300 sm:text-lg">{FAMILY_PRODUCT_STATEMENT}</p>
          <ul className="mx-auto mt-10 max-w-md space-y-2 text-left text-sm text-forward-300 sm:text-base">
            {[
              "Where are they?",
              "Where are they going?",
              "When will they arrive?",
              "Is this normal?",
              "What changed?",
              "Who’s headed there?",
              "Does anyone need me?",
              "What’s tomorrow look like?",
            ].map((q) => (
              <li key={q} className="flex gap-2">
                <span className="text-brand-cyan" aria-hidden>
                  →
                </span>
                {q}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-brand-green">
            That’s Family Intelligence.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 bg-forward-950 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <FamilyOmgChangeVisual />
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-t border-white/10 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything in MyMotiveLife Pro for you — plus family intelligence
          </h2>
          <p className="mt-4 max-w-2xl text-forward-300">
            Location is the foundation. Understanding is the product. Pro learns your personal
            places and movement; Family coordinates the household.
          </p>
          <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FAMILY_INTELLIGENCE_PILLARS.map((pillar) => (
              <li key={pillar.name}>
                <p className="font-display text-lg font-semibold text-white">{pillar.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-forward-400">{pillar.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-white/10 bg-forward-900/40 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Logistics intelligence for the household
          </h2>
          <p className="mt-4 max-w-2xl text-forward-300">
            Family Flow™ isn&apos;t a shared calendar. It&apos;s the Family Operating System —
            conflicts, routes, and the change that gets everyone there.
          </p>
          <div className="mt-10">
            <FamilyFlowLogisticsVisual />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-forward-50 py-20 text-forward-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Tap a place. See the story.
          </h2>
          <p className="mt-4 max-w-2xl text-forward-600">
            This isn’t just tracking — it’s place-level household intelligence.
          </p>
          <div className="mt-10">
            <FamilyPlaceIntelVisual />
          </div>
        </div>
      </section>

      <section className="border-t border-forward-200 bg-white py-20 text-forward-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Driving deserves its own moment
          </h2>
          <p className="mt-4 max-w-2xl text-forward-600">
            Data → Context → Intelligence. Drive Score with AI that knows what’s normal for your
            family.
          </p>
          <div className="mt-10 max-w-2xl">
            <FamilyDriveIntelVisual />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-forward-950 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Movement connected to life
          </h2>
          <p className="mt-4 max-w-2xl text-forward-300">
            Typical location apps can copy a prettier map. It’s much harder to copy a Digital Twin
            that understands what movement means to someone’s overall life.
          </p>
          <div className="mt-10">
            <FamilyLifeImpactVisual />
          </div>
        </div>
      </section>

      <section id="compare" className="scroll-mt-24 border-t border-forward-200 bg-white py-20 text-forward-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
            Not just location
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Family Intelligence
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-forward-600">{FAMILY_PRODUCT_STATEMENT}</p>
          <p className="mt-3 max-w-2xl text-sm text-forward-500">
            Everything you expect from a family location app… plus intelligence you’ve never had
            before.
          </p>
          <div className="mt-10">
            <FamilyComparisonVisual />
          </div>
          <p className="mt-6 text-center text-sm text-forward-600">
            Looking for Life360 alternatives?{" "}
            <Link
              href="/alternatives/life360"
              className="font-semibold text-brand-blue underline-offset-4 hover:underline"
            >
              Open the interactive comparison →
            </Link>
          </p>
          <p className="mx-auto mt-10 max-w-2xl text-center font-display text-xl font-semibold text-forward-900 sm:text-2xl">
            Tracking tells you what happened.
            <br />
            <span className="text-brand-blue">
              Intelligence tells you what it means — and what happens next.
            </span>
          </p>
          <div className="mt-8 flex justify-center">
            <Link href={FAMILY_MAP_PATH} className={buttonClassName({ size: "lg" })}>
              {FAMILY_CTA_PRIMARY}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <MarketingPricingSection />

      <section id="privacy" className="scroll-mt-24 border-t border-forward-200 bg-white py-20 text-forward-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for trust
          </h2>
          <p className="mt-4 max-w-2xl text-forward-600">
            Every adult controls what they share. The household never owns someone else’s private
            Twin.
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-3">
            {FAMILY_PRIVACY_PILLARS.map((pillar) => (
              <li key={pillar.title}>
                <p className="font-display text-xl font-semibold">{pillar.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-forward-600">{pillar.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-hero-bg py-24 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-cyan">
            {FAMILY_PRODUCT_NAME}
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            {FAMILY_PRODUCT_STATEMENT}
          </h2>
          <p className="mt-5 text-lg text-forward-300">
            Start your household. Invite your people. Let intelligence do the rest.
          </p>
          <CtaPair className="mt-10 justify-center" />
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

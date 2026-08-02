import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { buttonClassName } from "@/components/button";
import { FamilyCommandCenter } from "@/components/marketing/family-command-center";
import { LandingFooter } from "@/components/marketing/landing-footer";
import {
  FAMILY_CTA_PRIMARY,
  FAMILY_CTA_SECONDARY,
  FAMILY_DIFFERENT_DEMO,
  FAMILY_HERO_LINES,
  FAMILY_INTELLIGENCE_ENGINES,
  FAMILY_MAP_PATH,
  FAMILY_MAX_MEMBERS,
  FAMILY_MEMBER_PRO_UPGRADE_LABEL,
  FAMILY_PAGE_PATH,
  FAMILY_PLANS,
  FAMILY_PRICE_LABEL,
  FAMILY_PRIVACY_PILLARS,
  FAMILY_PRODUCT_HIGHLIGHTS,
  FAMILY_PRODUCT_NAME,
  FAMILY_SUPPORTING_LINE,
  LIFE_PRO_PRICE_LABEL,
  LOCATION_SHARING_LABELS,
} from "@/lib/family-marketing";

function FamilyNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-forward-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <BrandLogo href="/" size="md" className="shrink-0" variant="dark" />
        <nav className="hidden items-center gap-5 sm:flex" aria-label="Family">
          <Link href={`${FAMILY_PAGE_PATH}#how-it-works`} className="text-sm text-forward-300 hover:text-white">
            How it works
          </Link>
          <Link href={`${FAMILY_PAGE_PATH}#pricing`} className="text-sm text-forward-300 hover:text-white">
            Pricing
          </Link>
          <Link href={`${FAMILY_PAGE_PATH}#privacy`} className="text-sm text-forward-300 hover:text-white">
            Privacy
          </Link>
          <Link href="/" className="text-sm text-forward-300 hover:text-white">
            MyMotiveLife
          </Link>
        </nav>
        <Link
          href={FAMILY_MAP_PATH}
          className={buttonClassName({ size: "sm", className: "sm:px-5" })}
        >
          {FAMILY_CTA_PRIMARY}
        </Link>
      </div>
    </header>
  );
}

export function FamilyLandingPage() {
  return (
    <div className="min-h-screen bg-forward-950 text-white">
      <FamilyNav />

      <section className="landing-hero-bg relative overflow-hidden">
        <div className="landing-hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:pb-14 sm:pt-20">
          <p className="landing-fade-up text-sm font-semibold uppercase tracking-[0.22em] text-brand-cyan">
            {FAMILY_PRODUCT_NAME}
          </p>
          <h1 className="landing-fade-up landing-fade-up-delay-1 mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            <span className="block">{FAMILY_HERO_LINES[0]}</span>
            <span className="mt-2 block text-forward-100">{FAMILY_HERO_LINES[1]}</span>
          </h1>
          <p className="landing-fade-up landing-fade-up-delay-2 mt-5 max-w-2xl text-lg text-forward-300 sm:text-xl">
            {FAMILY_SUPPORTING_LINE}
          </p>
          <div className="landing-fade-up landing-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-3">
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
          <p className="mt-4 text-sm text-forward-400">
            Powered by MyMotiveLife · {FAMILY_PRICE_LABEL}
          </p>
        </div>

        <div className="relative mx-auto max-w-6xl px-0 sm:px-4 sm:pb-16">
          <FamilyCommandCenter />
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-t border-white/10 bg-forward-900/40 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            A live map — with household intelligence around it
          </h2>
          <p className="mt-4 max-w-2xl text-forward-300">
            Location is the foundation. What makes MyMotiveFamily different is how it understands
            your family as a whole.
          </p>
          <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {FAMILY_INTELLIGENCE_ENGINES.map((engine) => (
              <li key={engine.id}>
                <p className="font-display text-lg font-semibold text-white">
                  {engine.name.replace("™", "")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-forward-400">{engine.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-white/10 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {FAMILY_DIFFERENT_DEMO.title}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-forward-300">{FAMILY_DIFFERENT_DEMO.body}</p>
          <p className="mt-4 text-sm font-medium text-brand-cyan">{FAMILY_DIFFERENT_DEMO.tone}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {FAMILY_DIFFERENT_DEMO.actions.map((action) => (
              <span
                key={action}
                className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white"
              >
                {action}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-forward-950 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            What you get
          </h2>
          <p className="mt-4 max-w-2xl text-forward-300">
            Everything you need to run the household with clarity — from the map to the moments that
            matter.
          </p>
          <ul className="mt-10 columns-1 gap-x-12 space-y-3 sm:columns-2">
            {FAMILY_PRODUCT_HIGHLIGHTS.map((feature) => (
              <li key={feature} className="flex break-inside-avoid gap-2 text-sm text-forward-200">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 border-t border-white/10 bg-white py-20 text-forward-900 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Simple household pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-forward-600">
            {FAMILY_PRICE_LABEL} for the household. Invited members can upgrade their private Twin
            for {FAMILY_MEMBER_PRO_UPGRADE_LABEL} — up to {FAMILY_MAX_MEMBERS} people.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {FAMILY_PLANS.map((plan) => {
              const highlighted = plan.id === "family";
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-3xl border p-6 ${
                    highlighted
                      ? "border-brand-cyan bg-forward-950 text-white shadow-xl"
                      : "border-forward-200 bg-forward-50"
                  }`}
                >
                  <p className="text-sm font-semibold uppercase tracking-widest opacity-80">
                    {plan.name}
                  </p>
                  <p className="mt-3 font-display text-3xl font-semibold">
                    {plan.id === "family_member_pro" ? plan.priceLabel : `$${plan.priceCad.toFixed(2)}`}
                    {plan.id !== "family_member_pro" ? (
                      <span className="ml-2 text-base font-normal opacity-70">CAD / month</span>
                    ) : null}
                  </p>
                  <p className={`mt-2 text-sm ${highlighted ? "text-forward-300" : "text-forward-600"}`}>
                    {plan.summary}
                  </p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.includes.map((item) => (
                      <li key={item} className="flex gap-2 text-sm">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-brand-green" : "text-brand-blue"}`}
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={
                      plan.id === "life_pro"
                        ? "/register"
                        : plan.id === "family"
                          ? FAMILY_MAP_PATH
                          : "/register?plan=family"
                    }
                    className={buttonClassName({
                      size: "lg",
                      variant: highlighted ? "primary" : "secondary",
                      className: "mt-8 w-full",
                    })}
                  >
                    {plan.id === "life_pro"
                      ? "Start Pro trial"
                      : plan.id === "family"
                        ? FAMILY_CTA_PRIMARY
                        : "Join a family"}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-sm text-forward-500">
            MyMotiveLife Pro on its own is {LIFE_PRO_PRICE_LABEL}. Family members upgrade for less
            when they’re already in a household.
          </p>
        </div>
      </section>

      <section id="privacy" className="scroll-mt-24 border-t border-forward-200 bg-forward-50 py-20 text-forward-900 sm:py-24">
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
          <p className="mt-10 text-sm text-forward-500">
            Sharing levels: {Object.values(LOCATION_SHARING_LABELS).join(" · ")}.
          </p>
        </div>
      </section>

      <section className="landing-hero-bg py-24 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-cyan">
            {FAMILY_PRODUCT_NAME}
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Your family. One step ahead.
          </h2>
          <p className="mt-5 text-lg text-forward-300">
            Open the Family Map and invite your household.
          </p>
          <Link href={FAMILY_MAP_PATH} className={buttonClassName({ size: "lg", className: "mt-10" })}>
            {FAMILY_CTA_PRIMARY}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

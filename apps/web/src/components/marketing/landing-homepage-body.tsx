import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { buttonClassName } from "@/components/button";
import {
  CONNECTED_CHAIN,
  DASHBOARD_QUESTIONS,
  FEATURE_STORIES,
  FINAL_CTA_BUTTON,
  FINAL_CTA_HEADLINE,
  FINAL_CTA_SUBHEAD,
  FUTURE_DASHBOARD_METRICS,
  FUTURE_TIMELINE,
  IMAGINE_ASKING,
  PRICING_TIERS,
  TWIN_BUILD_STEPS,
  TRUST_PILLARS,
} from "@/lib/marketing-copy";
import { FEATURED_BLOG_LINKS } from "@/lib/blog-content";
import { FAMILY_HOME_TEASER } from "@/lib/family-marketing";
import { LandingLifeNetwork } from "./landing-life-network";
import { LandingDemoVideo } from "./landing-demo-video";

/** Establishes the two-product architecture near the top of the homepage. */
export function LandingTwoProducts() {
  return (
    <section
      id="products"
      className="scroll-mt-24 border-b border-forward-200 bg-gradient-to-b from-forward-950 via-forward-900 to-forward-950 py-16 text-white sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          One AI for your life. One AI for your family.
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 sm:gap-12">
          <div className="border-t border-brand-cyan/50 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
              MyMotiveLife
            </p>
            <p className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">
              Understand where your life is headed.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-forward-300">
              Digital Twin™, Life Momentum, Future Simulator — AI that models how your whole life
              connects.
            </p>
            <a
              href="#digital-twin"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-cyan hover:underline"
            >
              Explore MyMotiveLife
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
          <div className="border-t border-brand-green/50 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
              MyMotiveFamily
            </p>
            <p className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">
              Understand how your family lives, moves and connects.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-forward-300">
              Family Intelligence — not just location. Map, routines, places, driving, and what it
              means for life.
            </p>
            <Link
              href="/family"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green hover:underline"
            >
              Explore MyMotiveFamily
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFamilyTeaser() {
  return (
    <section className="border-y border-forward-200 bg-forward-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
          {FAMILY_HOME_TEASER.eyebrow}
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
          {FAMILY_HOME_TEASER.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-forward-600">{FAMILY_HOME_TEASER.body}</p>
        <Link
          href="/family"
          className={buttonClassName({ size: "lg", className: "mt-8" })}
        >
          {FAMILY_HOME_TEASER.cta}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function LandingDashboardAsk() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          What if your life had a dashboard?
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-forward-600">
          Imagine waking up and instantly knowing…
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {DASHBOARD_QUESTIONS.map((q) => (
            <li
              key={q}
              className="flex gap-3 border-l-2 border-brand-cyan/60 pl-4 text-base text-forward-800"
            >
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden />
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LandingMeetTwin() {
  const flow = ["Profile", "Habits", "Income", "Goals", "Calendar", "Health", "Investments"];
  return (
    <section id="digital-twin" className="scroll-mt-24 border-y border-forward-200 bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
          Meet Your Digital Twin™
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          Not another profile. A living AI model of how your life works.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-forward-600">
          The more it understands… the more accurate your predictions become. Everything connects.
        </p>
        <p className="mt-4">
          <Link
            href="/blog/what-is-a-digital-twin-for-your-life"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline"
          >
            Read: What is a Digital Twin for your life?
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
        <div className="mt-12 flex flex-wrap items-center gap-2 sm:gap-3">
          {flow.map((item, i) => (
            <div key={item} className="flex items-center gap-2 sm:gap-3">
              <span className="rounded-full border border-forward-200 bg-white px-4 py-2 text-sm font-semibold text-forward-800">
                {item}
              </span>
              {i < flow.length - 1 ? (
                <span className="text-forward-300" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingBuildSteps() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          Build Your Digital Twin
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-forward-600">
          Watch prediction accuracy climb as your Twin learns.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TWIN_BUILD_STEPS.map((s) => (
            <div key={s.step} className="border-t-2 border-brand-cyan pt-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
                Step {s.step}
              </p>
              <p className="mt-2 font-display text-xl font-semibold text-forward-900">{s.title}</p>
              <p className="mt-4 text-4xl font-bold tabular-nums text-brand-blue">{s.accuracy}%</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-forward-500">
                Prediction accuracy
              </p>
              <p className="mt-3 text-sm leading-relaxed text-forward-600">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFutureDashboard() {
  return (
    <section id="dashboard" className="landing-hero-bg relative overflow-hidden py-20 text-white sm:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <LandingLifeNetwork />
      </div>
      <div className="relative mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
          The Future Dashboard
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          Life Momentum — one living read on where you&apos;re headed.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUTURE_DASHBOARD_METRICS.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 backdrop-blur-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
                {m.label}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-white">{m.value}</p>
              <p className="mt-1 text-sm text-forward-300">{m.status}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-brand-green/30 bg-brand-green/10 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-green">
            Next Best Decision
          </p>
          <p className="mt-2 font-display text-2xl font-medium text-white">
            Ask for a salary review before September.
          </p>
          <p className="mt-2 text-sm text-forward-200">
            Estimated lifetime impact: <strong className="text-white">+CA$310,000</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

export function LandingConnectedChain() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          Your life is connected
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-forward-600">
          Everything influences everything. Traditional apps never connect the dots. MyMotiveLife
          does.
        </p>
        <div className="mt-12 flex flex-wrap items-center gap-2">
          {CONNECTED_CHAIN.map((item, i) => (
            <div key={item} className="flex items-center gap-2">
              <span className="rounded-full bg-forward-950 px-3 py-1.5 text-xs font-semibold text-white">
                {item}
              </span>
              {i < CONNECTED_CHAIN.length - 1 ? (
                <span className="text-brand-cyan" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFeatureStories() {
  return (
    <section id="features" className="scroll-mt-24 border-y border-forward-200 bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          Features as stories
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {FEATURE_STORIES.map((f) => (
            <div key={f.name}>
              <h3 className="font-display text-xl font-semibold text-forward-900">{f.name}</h3>
              <p className="mt-3 text-base leading-relaxed text-forward-600">{f.story}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingImagineAsking() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          Imagine asking…
        </h2>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {IMAGINE_ASKING.map((q) => (
            <p
              key={q}
              className="rounded-2xl border border-forward-200 bg-forward-50 px-4 py-5 text-sm font-medium leading-snug text-forward-800"
            >
              {q}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingMeetFuture() {
  return (
    <section className="landing-hero-bg py-20 text-white sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          Meet your future
        </h2>
        <p className="mt-4 max-w-2xl text-forward-300">
          An interactive timeline — financial, health, career, lifestyle, risk, and happiness.
        </p>
        <div className="mt-12 flex flex-col gap-0 border-l border-brand-cyan/40 pl-6">
          {FUTURE_TIMELINE.map((t) => (
            <div key={t.label} className="relative pb-10 last:pb-0">
              <span className="absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full bg-brand-cyan" />
              <p className="font-display text-xl font-semibold">{t.label}</p>
              <p className="mt-1 text-sm text-forward-300">{t.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPrivacyOwn() {
  return (
    <section id="trust" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          Your Digital Twin belongs to you.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-forward-600">
          Not advertisers. Not data brokers. Not anyone else.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {TRUST_PILLARS.map((p) => (
            <div key={p.title}>
              <h3 className="font-display text-xl font-semibold text-forward-900">{p.title}</h3>
              <p className="mt-2 text-forward-600">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingGrowsWithYou() {
  return (
    <section className="border-y border-forward-200 bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          The AI that grows with you
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-forward-600">
          The longer you use MyMotiveLife, the smarter it becomes. Unlike traditional software, your
          Digital Twin never stops learning.
        </p>
      </div>
    </section>
  );
}

export function LandingPricingTiers() {
  return (
    <section id="pricing" className="scroll-mt-24 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-5xl">
          Pricing
        </h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`flex flex-col rounded-3xl border p-6 ${
                tier.highlighted
                  ? "border-brand-cyan bg-forward-950 text-white shadow-xl"
                  : "border-forward-200 bg-forward-50 text-forward-900"
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-widest opacity-80">{tier.name}</p>
              <p className="mt-3 font-display text-3xl font-semibold">
                {tier.price}
                {tier.period ? (
                  <span className="ml-2 text-base font-normal opacity-70">{tier.period}</span>
                ) : null}
              </p>
              {"trial" in tier && tier.trial ? (
                <p className="mt-2 text-sm opacity-80">{tier.trial}</p>
              ) : null}
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              {tier.id === "family" ? (
                <p
                  className={`mt-4 text-xs leading-relaxed ${
                    tier.highlighted ? "text-forward-300" : "text-forward-500"
                  }`}
                >
                  Family members can upgrade their private Digital Twin to Pro for only $5/month.
                  Their personal MyMotiveLife data remains private.
                </p>
              ) : null}
              <Link
                href={tier.id === "family" ? "/family" : "/register"}
                className={buttonClassName({
                  size: "lg",
                  variant: tier.highlighted ? "primary" : "secondary",
                  className: "mt-8 w-full",
                })}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFinalCta() {
  return (
    <section className="landing-hero-bg py-24 text-white">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          {FINAL_CTA_HEADLINE}
        </h2>
        <p className="mt-5 text-lg text-forward-300">{FINAL_CTA_SUBHEAD}</p>
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
    <section id="demo" className="scroll-mt-24 bg-forward-950 py-16 text-white">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Product demo</h2>
        <p className="mt-3 text-forward-400">
          45 seconds — voice, daily brief, and Life Graph. Hit play.
        </p>
        <div className="mt-8">
          <LandingDemoVideo />
        </div>
        <p className="mt-6 text-sm text-forward-500">
          Prefer the interactive path?{" "}
          <a href="#future-snapshot" className="font-semibold text-brand-cyan hover:underline">
            Get a Future Snapshot in under a minute
          </a>
          .
        </p>
      </div>
    </section>
  );
}

/** Organic SEO surface — featured guides linked from homepage */
export function LandingGuidesSeo() {
  return (
    <section id="guides" className="scroll-mt-24 border-y border-forward-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">Learn</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
              Guides & articles
            </h2>
            <p className="mt-3 max-w-xl text-forward-600">
              Practical reads on Digital Twins, AI planning, and using MotiveLife day to day.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline"
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
                className="block h-full border-l-2 border-brand-cyan/50 py-1 pl-4 transition hover:border-brand-blue"
              >
                <p className="font-semibold text-forward-900">{item.label}</p>
                <p className="mt-1 text-sm text-forward-600">{item.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Full homepage body after hero + Future Snapshot */
export function LandingHomepageBody() {
  return (
    <>
      <LandingTwoProducts />
      <LandingDashboardAsk />
      <LandingMeetTwin />
      <LandingBuildSteps />
      <LandingFutureDashboard />
      <LandingConnectedChain />
      <LandingFeatureStories />
      <LandingImagineAsking />
      <LandingMeetFuture />
      <LandingFamilyTeaser />
      <LandingPrivacyOwn />
      <LandingGrowsWithYou />
      <LandingPricingTiers />
      <LandingFinalCta />
      <LandingDemoAnchor />
      <LandingGuidesSeo />
    </>
  );
}

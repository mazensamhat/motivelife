import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClassName } from "@/components/button";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingNav } from "@/components/marketing/landing-nav";
import { Life360AlternativesTable } from "@/components/marketing/life360-alternatives-table";
import {
  FAMILY_MAP_PATH,
  FAMILY_PAGE_PATH,
  FAMILY_PRICE_LABEL,
  FAMILY_PRODUCT_NAME,
} from "@/lib/family-marketing";
import {
  LIFE360_ALTERNATIVES,
  LIFE360_ALT_META,
  LIFE360_ALT_REVIEWED,
  STRENGTH_BANDS,
} from "@/lib/life360-alternatives";

export function Life360AlternativesPage() {
  return (
    <div className="min-h-screen bg-forward-50 text-forward-900">
      <LandingNav activeLabel="KINZO" />

      {/* Hero — one composition: brand, H1, support, CTAs, atmosphere */}
      <section className="relative overflow-hidden bg-forward-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(0,198,255,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(0,255,135,0.12), transparent 50%), linear-gradient(180deg, #050d18 0%, #0a1930 55%, #122844 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(180deg, black 30%, transparent 90%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <p className="landing-fade-up text-sm font-semibold uppercase tracking-[0.22em] text-brand-cyan">
            {FAMILY_PRODUCT_NAME}
          </p>
          <h1 className="landing-fade-up-delay-1 mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {LIFE360_ALT_META.title}
          </h1>
          <p className="landing-fade-up-delay-2 mt-5 max-w-2xl text-lg text-forward-200 sm:text-xl">
            Compare leading family-location apps across tracking, driving, safety — and the layer
            KINZO AI is built for: AI-powered Family Intelligence.
          </p>
          <div className="landing-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Link href={FAMILY_MAP_PATH} className={buttonClassName({ size: "lg" })}>
              Start free KINZO map
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="#compare"
              className={buttonClassName({
                size: "lg",
                variant: "secondary",
                className: "bg-white/10 text-white hover:bg-white/15",
              })}
            >
              Jump to comparison
            </Link>
          </div>
          <p className="mt-6 max-w-2xl text-sm text-forward-400">
            Published by MyMotiveLife · Reviewed {LIFE360_ALT_REVIEWED} · Canada-friendly pricing in
            CAD · Live map free forever
          </p>
        </div>
      </section>

      <section className="border-b border-forward-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="alt-key-diff relative overflow-hidden rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-brand-blue/[0.07] via-white to-brand-cyan/[0.06] px-5 py-6 sm:px-8 sm:py-7">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-brand-blue" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
              The key difference
            </p>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-forward-800 sm:text-xl">
              Most family apps answer <span className="font-semibold text-forward-950">“Where are they?”</span>{" "}
              KINZO AI is designed to also answer{" "}
              <span className="font-semibold text-forward-950">
                “Where are they going? Is this normal? What changed? Does anyone need me? And what
                happens next?”
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <ul className="grid gap-8 md:grid-cols-3 md:gap-10">
            {STRENGTH_BANDS.map((band, i) => (
              <li key={band.title} className="relative pl-4">
                <span
                  className="absolute left-0 top-1 h-full w-0.5 rounded-full bg-gradient-to-b from-brand-cyan to-brand-blue/30"
                  aria-hidden
                />
                <p className="font-display text-lg font-semibold text-forward-900">{band.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-forward-600">{band.body}</p>
                <span className="mt-3 block font-display text-3xl font-semibold tabular-nums text-forward-200">
                  0{i + 1}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="compare" className="scroll-mt-24 border-t border-forward-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Feature comparison
          </h2>
          <p className="mt-3 max-w-2xl text-forward-600">
            Filter by category. KINZO AI wins on Family Intelligence — not by claiming to beat
            Life360 at roadside or emergency infrastructure.
          </p>
          <div className="mt-10">
            <Life360AlternativesTable />
          </div>
        </div>
      </section>

      <section id="roundup" className="scroll-mt-24 border-t border-forward-200 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            The 7 alternatives — and why someone might choose each
          </h2>
          <p className="mt-3 max-w-2xl text-forward-600">
            A fair roundup. Each option has a legitimate strength. We publish this comparison as
            MyMotiveLife — including our own product.
          </p>

          <ol className="mt-12 space-y-0 divide-y divide-forward-200 border-y border-forward-200">
            {LIFE360_ALTERNATIVES.map((alt, index) => (
              <li
                key={alt.id}
                className={`grid gap-4 py-8 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:gap-8 ${
                  alt.featured ? "bg-gradient-to-r from-brand-blue/[0.04] to-transparent" : ""
                }`}
              >
                <span className="font-display text-3xl font-semibold tabular-nums text-forward-300 sm:pt-1">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-display text-xl font-semibold text-forward-950 sm:text-2xl">
                      {alt.name}
                    </h3>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">
                      {alt.tag}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-forward-700">{alt.whyChoose}</p>
                  <p className="mt-3 text-sm text-forward-600">
                    <span className="font-medium text-forward-800">Best for:</span> {alt.bestFor}
                  </p>
                  <p className="mt-1 text-sm text-forward-500">
                    <span className="font-medium text-forward-700">Limit:</span> {alt.limit}
                  </p>
                </div>
                {alt.href ? (
                  <Link
                    href={alt.href}
                    className={buttonClassName({
                      size: "md",
                      className: "sm:mt-1",
                    })}
                  >
                    Explore
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                ) : (
                  <span className="hidden text-sm text-forward-400 sm:block sm:pt-2">Independent</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-forward-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Which should you choose?
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2">
            <div className="border-t-2 border-forward-300 pt-6">
              <h3 className="font-display text-xl font-semibold text-forward-900">
                Choose a traditional family tracker if…
              </h3>
              <p className="mt-3 text-forward-600">
                Your priority is established emergency assistance, roadside protection, simple
                location sharing, or parental-monitoring tools.
              </p>
            </div>
            <div className="border-t-2 border-brand-blue pt-6">
              <h3 className="font-display text-xl font-semibold text-forward-900">
                Choose KINZO AI if…
              </h3>
              <p className="mt-3 text-forward-600">
                You want location to become intelligence: routines, prediction, household
                coordination, peace of mind, and insight into how movement affects the rest of life.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-forward-950 py-16 text-white sm:py-20">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,198,255,0.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-cyan">
            {FAMILY_PRODUCT_NAME}
          </p>
          <p className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            A map tells you where they are.{" "}
            <span className="text-brand-cyan">AI understands what’s happening.</span>
          </p>
          <p className="mt-4 text-sm tracking-wide text-forward-400 sm:text-base">
            Location → Context → Patterns → Prediction → Coordination → Life Impact
          </p>
          <p className="mx-auto mt-4 max-w-xl text-forward-300">
            Free live KINZO map forever. Family Intelligence ({FAMILY_PRICE_LABEL}) includes
            MyMotiveLife Pro for the owner.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={FAMILY_MAP_PATH} className={buttonClassName({ size: "lg" })}>
              Start free map
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={FAMILY_PAGE_PATH}
              className={buttonClassName({
                size: "lg",
                variant: "secondary",
                className: "bg-white/10 text-white hover:bg-white/15",
              })}
            >
              Explore KINZO AI
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-forward-200 bg-forward-50 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <p className="max-w-4xl text-xs leading-relaxed text-forward-500">
            Comparison should be reviewed before publication and periodically thereafter. Competitor
            features vary by country, device, and plan. KINZO AI claims describe features that
            are live or clearly labeled Coming Soon. Last reviewed {LIFE360_ALT_REVIEWED}. This page
            is published by MotiveLife, which builds KINZO AI.
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

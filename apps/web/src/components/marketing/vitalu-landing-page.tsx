import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClassName } from "@/components/button";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingNav } from "@/components/marketing/landing-nav";
import { ProductSuiteIcon } from "@/components/product-icons";
import {
  VITALU_APP_PATH,
  VITALU_CATEGORY,
  VITALU_CTA_PRIMARY,
  VITALU_CTA_SECONDARY,
  VITALU_ECOSYSTEM_LINE,
  VITALU_FEATURES,
  VITALU_HERO_LINES,
  VITALU_PAGE_PATH,
  VITALU_PILLARS,
  VITALU_PRODUCT_NAME,
  VITALU_SUPPORTING_LINE,
  VITALU_TAGLINE,
  VITALU_WELLNESS_LINE,
} from "@/lib/vitalu-marketing";
import { PRODUCT_SUITE } from "@/lib/product-suite";

const brand = PRODUCT_SUITE.vitalu;

function CtaPair({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link href={VITALU_APP_PATH} className={buttonClassName({ size: "lg" })}>
        {VITALU_CTA_PRIMARY}
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
      </Link>
      <Link
        href="/register"
        className={buttonClassName({
          size: "lg",
          variant: "secondary",
          className: "border-white/20 bg-white/5 text-white hover:bg-white/10",
        })}
      >
        {VITALU_CTA_SECONDARY}
      </Link>
    </div>
  );
}

export function VitaluLandingPage() {
  return (
    <div className="min-h-screen bg-forward-950 text-white">
      <LandingNav activeLabel="Vitalu" />

      <section className="landing-hero-bg relative overflow-hidden">
        <div className="landing-hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pb-20 sm:pt-20">
          <p
            className="text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: brand.primaryLight }}
          >
            {VITALU_PRODUCT_NAME} · {VITALU_CATEGORY}
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(120deg, ${brand.primaryLight}, ${brand.primary}, ${brand.primaryDark})`,
              }}
            >
              {VITALU_PRODUCT_NAME}
            </span>
            <span className="mt-3 block text-forward-100">{VITALU_HERO_LINES[0]}</span>
            <span className="mt-2 block text-forward-200">{VITALU_HERO_LINES[1]}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-forward-300 sm:text-xl">{VITALU_TAGLINE}</p>
          <p className="mt-3 max-w-2xl text-base text-forward-400">{VITALU_SUPPORTING_LINE}</p>
          <p className="mt-4 inline-flex rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-green-200">
            Wellness software — not medical advice
          </p>
          <CtaPair className="mt-8" />
          <p className="mt-4 text-sm text-forward-400">{VITALU_ECOSYSTEM_LINE}</p>
        </div>
      </section>

      <section className="border-y border-white/10 bg-forward-900/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15">
              <ProductSuiteIcon id="vitalu" className="h-10 w-10" />
            </span>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              A Health Operating Engine
            </h2>
          </div>
          <p className="mt-4 max-w-2xl text-base text-forward-300">
            Goal → Plan → Do → Track → Feedback → Adapt. Calorie tracking is one capability — not the
            product.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {VITALU_PILLARS.map((pillar) => (
              <article key={pillar.title} className="rounded-2xl border border-green-400/20 bg-green-500/5 p-6">
                <h3 className="font-display text-xl font-semibold text-white">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-forward-300">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Vital Score, a real plan, and your actual life.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {VITALU_FEATURES.map((feature) => (
              <article key={feature.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forward-400">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-forward-900/40 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">MyMotiveLife suite</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">{VITALU_TAGLINE}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-forward-300">{VITALU_WELLNESS_LINE}</p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-forward-400">{VITALU_ECOSYSTEM_LINE}</p>
          <CtaPair className="mt-8 justify-center" />
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

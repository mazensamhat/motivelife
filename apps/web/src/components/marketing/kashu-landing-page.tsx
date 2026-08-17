import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClassName } from "@/components/button";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingNav } from "@/components/marketing/landing-nav";
import {
  KashuPillarsVisual,
  KashuSafeToSpendHeroVisual,
} from "@/components/marketing/kashu-marketing-visuals";
import { ModulePencilVideoPlayer } from "@/components/marketing/module-pencil-video-player";
import { getModulePencilVideo } from "@/lib/module-pencil-videos";
import {
  KASHU_APP_PATH,
  KASHU_CATEGORY,
  KASHU_CTA_PRIMARY,
  KASHU_CTA_SECONDARY,
  KASHU_ECOSYSTEM_LINE,
  KASHU_FEATURES,
  KASHU_FORMULA,
  KASHU_HERO_LINES,
  KASHU_INTELLIGENCE_PILLARS,
  KASHU_PAGE_PATH,
  KASHU_PRIVACY_PILLARS,
  KASHU_PRODUCT_NAME,
  KASHU_PRODUCT_STATEMENT,
  KASHU_SUCCESS_QUESTIONS,
  KASHU_SUPPORTING_LINE,
  KASHU_TAGLINE,
} from "@/lib/kashu-marketing";
import { PRODUCT_SUITE } from "@/lib/product-suite";

const brand = PRODUCT_SUITE.kashu;

function CtaPair({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link href={KASHU_APP_PATH} className={buttonClassName({ size: "lg" })}>
        {KASHU_CTA_PRIMARY}
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
        {KASHU_CTA_SECONDARY}
      </Link>
    </div>
  );
}

export function KashuLandingPage() {
  return (
    <div className="min-h-screen bg-forward-950 text-white">
      <LandingNav activeLabel="Kashu" />

      <section className="landing-hero-bg relative overflow-hidden">
        <div className="landing-hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:pb-14 sm:pt-20">
          <p
            className="landing-fade-up text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: brand.primaryLight }}
          >
            {KASHU_PRODUCT_NAME} · {KASHU_CATEGORY}
          </p>
          <h1 className="landing-fade-up landing-fade-up-delay-1 mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(120deg, ${brand.primaryLight}, ${brand.primary}, ${brand.primaryDark})`,
              }}
            >
              {KASHU_PRODUCT_NAME}
            </span>
            <span className="mt-3 block text-forward-100">{KASHU_HERO_LINES[0]}</span>
            <span className="mt-2 block text-forward-200">{KASHU_HERO_LINES[1]}</span>
          </h1>
          <p className="landing-fade-up landing-fade-up-delay-2 mt-5 max-w-2xl text-lg text-forward-300 sm:text-xl">
            {KASHU_TAGLINE}
          </p>
          <p className="landing-fade-up landing-fade-up-delay-2 mt-3 max-w-2xl text-base text-forward-400">
            {KASHU_SUPPORTING_LINE}
          </p>
          <p className="landing-fade-up landing-fade-up-delay-2 mt-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
            No bank connection required
          </p>
          <CtaPair className="landing-fade-up landing-fade-up-delay-3 mt-8" />
          <p className="mt-4 text-sm text-forward-400">{KASHU_ECOSYSTEM_LINE}</p>
        </div>

        <div className="relative mx-auto max-w-6xl px-0 sm:px-4 sm:pb-10">
          <KashuSafeToSpendHeroVisual />
        </div>
      </section>

      <section id="product-video" className="scroll-mt-24 border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Product video
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Kashu in under a minute
          </h2>
          <p className="mt-4 max-w-2xl text-base text-forward-300">
            Safe to Spend, timing, and why bank connect is not required.
          </p>
          <div className="mt-8">
            <ModulePencilVideoPlayer
              video={getModulePencilVideo("kashu")!}
              paper={false}
            />
          </div>
          <p className="mt-4 text-sm text-forward-400">
            More suite videos:{" "}
            <Link href="/videos" className="text-emerald-300 hover:underline">
              /videos
            </Link>
          </p>
        </div>
      </section>

      <section className="border-y border-white/10 bg-forward-900/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            {KASHU_FORMULA.eyebrow}
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            {KASHU_FORMULA.headline}
          </h2>
          <p className="mt-4 max-w-2xl font-mono text-sm text-emerald-200/80 sm:text-base">
            {KASHU_FORMULA.equation}
          </p>
          <p className="mt-4 max-w-2xl text-base text-forward-300">{KASHU_FORMULA.detail}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {KASHU_FORMULA.parts.map((part) => (
              <article
                key={part.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h3 className="text-lg font-semibold text-white">{part.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forward-400">{part.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            How it works
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Three jobs. One Safe to Spend number.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-forward-300">{KASHU_PRODUCT_STATEMENT}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {KASHU_INTELLIGENCE_PILLARS.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6"
              >
                <h3 className="font-display text-xl font-semibold text-white">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-forward-300">{pillar.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-10">
            <KashuPillarsVisual />
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-y border-white/10 bg-forward-900/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Inside Kashu
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Know before you spend.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-forward-300">
            Upload or enter. Kashu learns timing, obligations, and your spend envelope — Payday Mode,
            Can I Afford, Ask Kashu, and Life OS hooks from KINZO, DayO, and UPLIFT. No bank connection.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {KASHU_FEATURES.map((feature) => (
              <article
                key={feature.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forward-400">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Open Kashu and answer these in seconds.
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {KASHU_SUCCESS_QUESTIONS.map((q) => (
              <li
                key={q}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-forward-200"
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-white/10 bg-forward-900/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Privacy & control
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your money model stays yours.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {KASHU_PRIVACY_PILLARS.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forward-400">{pillar.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            MyMotiveLife suite
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            {KASHU_TAGLINE}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-forward-300">{KASHU_ECOSYSTEM_LINE}</p>
          <CtaPair className="mt-8 justify-center" />
        </div>
      </section>

      <section className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-forward-400">
          Comparing budget apps?{" "}
          <Link href="/alternatives/ynab" className="font-medium text-emerald-300 hover:underline">
            YNAB alternatives — see how Kashu compares
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

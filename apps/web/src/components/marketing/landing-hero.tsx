import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/button";
import {
  CATEGORY_NAME,
  HERO_HEADLINE,
  HERO_HEADLINE_ACCENT,
  HERO_SUBHEAD,
  TRIAL_DAYS,
} from "@/lib/marketing-copy";
import { LandingLivePhone } from "./landing-live-phone";

export function LandingHero() {
  return (
    <section className="landing-hero-bg relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 landing-hero-glow" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28 lg:pt-16">
        <div>
          <p className="inline-flex rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-cyan">
            {CATEGORY_NAME}
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            {HERO_HEADLINE}
            <span className="mt-3 block text-xl font-medium leading-snug text-forward-200 sm:text-2xl lg:text-[1.65rem]">
              {HERO_HEADLINE_ACCENT}
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-forward-300">{HERO_SUBHEAD}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                See what your AI already knows
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="#predictions">
              <Button
                size="lg"
                variant="secondary"
                className="w-full border border-white/15 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
              >
                Watch it think
              </Button>
            </Link>
          </div>
          <ul className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
            {[
              "No credit card to start",
              `${TRIAL_DAYS}-day full Pro trial`,
              "Your data never sold",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-forward-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center lg:items-end">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-forward-400 lg:text-right">
            Live demo — this AI knows your life
          </p>
          <LandingLivePhone />
        </div>
      </div>
    </section>
  );
}

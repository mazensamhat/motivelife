import Link from "next/link";
import { ArrowRight, CheckCircle2, Mic } from "lucide-react";
import { Button } from "@/components/button";
import {
  HERO_HEADLINE,
  HERO_HEADLINE_ACCENT,
  HERO_SUBHEAD,
  MARKETING_TAGLINE,
  TRIAL_DAYS,
} from "@/lib/marketing-copy";
import { LandingDemoVideo } from "./landing-demo-video";

export function LandingHero() {
  return (
    <section className="landing-hero-bg relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 landing-hero-glow" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-forward-200">
            <Mic className="h-3.5 w-3.5 text-brand-cyan" aria-hidden />
            {MARKETING_TAGLINE}
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            {HERO_HEADLINE}
            <span className="mt-2 block text-2xl font-medium leading-snug text-forward-200 sm:text-3xl lg:text-[2rem]">
              {HERO_HEADLINE_ACCENT}
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-forward-300">{HERO_SUBHEAD}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start {TRIAL_DAYS}-day free trial
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="#compare">
              <Button
                size="lg"
                variant="secondary"
                className="w-full border border-white/15 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
              >
                See how we&apos;re different
              </Button>
            </Link>
          </div>
          <ul className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
            {[
              "No credit card to explore",
              "Full Pro trial for 14 days",
              "Cancel anytime in Settings",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-forward-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <LandingDemoVideo />
          <div className="absolute -bottom-4 -left-2 hidden rounded-lg border border-white/10 bg-forward-900 px-3 py-2 text-xs text-forward-300 shadow-xl sm:block">
            Voice → plans → briefing → action
          </div>
        </div>
      </div>
    </section>
  );
}

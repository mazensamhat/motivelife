"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { buttonClassName } from "@/components/button";
import {
  BRAND_NAME,
  HERO_CTA,
  HERO_HEADLINE,
  HERO_SECONDARY_CTA,
  HERO_SUBHEAD,
  TRIAL_DAYS,
} from "@/lib/marketing-copy";
import { LandingLifeNetwork } from "./landing-life-network";

export function LandingHero() {
  return (
    <section className="landing-hero-bg relative min-h-[100svh] overflow-hidden text-white">
      <LandingLifeNetwork />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-forward-950/40 via-forward-950/55 to-forward-950" aria-hidden />

      <div className="relative mx-auto flex min-h-[100svh] max-w-5xl flex-col justify-center px-4 pb-24 pt-28 text-center sm:pb-28 sm:pt-32">
        <p className="landing-fade-up font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
          {BRAND_NAME}
        </p>
        <h1 className="landing-fade-up landing-fade-up-delay-1 mt-5 font-display text-3xl font-medium leading-tight tracking-tight text-forward-50 sm:text-4xl lg:text-5xl">
          {HERO_HEADLINE}
        </h1>
        <p className="landing-fade-up landing-fade-up-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-forward-300 sm:text-xl">
          {HERO_SUBHEAD}
        </p>
        <div className="landing-fade-up landing-fade-up-delay-3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className={buttonClassName({ size: "lg", className: "w-full sm:w-auto" })}>
            {HERO_CTA}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
          <a
            href="#demo"
            className={buttonClassName({
              size: "lg",
              variant: "secondary",
              className:
                "w-full border border-white/15 bg-white/10 text-white hover:bg-white/15 sm:w-auto",
            })}
          >
            <Play className="mr-2 h-4 w-4" aria-hidden />
            {HERO_SECONDARY_CTA}
          </a>
        </div>
        <p className="landing-fade-up landing-fade-up-delay-3 mt-6 text-sm text-forward-400">
          No credit card · {TRIAL_DAYS}-day Pro trial · Your Twin belongs to you
        </p>
      </div>
    </section>
  );
}

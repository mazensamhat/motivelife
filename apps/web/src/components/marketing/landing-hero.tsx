"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { buttonClassName } from "@/components/button";
import {
  BRAND_NAME,
  HERO_CTA,
  HERO_HEADLINE,
  HERO_OS_LINE,
  HERO_SECONDARY_CTA,
  HERO_SUBHEAD,
  TRIAL_DAYS,
} from "@/lib/marketing-copy";
import { LandingHeroPhoneDemo } from "./landing-hero-phone-demo";

export function LandingHero() {
  return (
    <section className="landing-hero-bg relative min-h-[100svh] overflow-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070B14]/20 via-[#070B14]/60 to-[#070B14]"
        aria-hidden
      />

      <div className="relative mx-auto grid min-h-[100svh] max-w-6xl items-center gap-12 px-4 pb-20 pt-28 lg:grid-cols-2 lg:gap-16 lg:pb-24 lg:pt-32">
        <div className="text-center lg:text-left">
          <p className="landing-fade-up font-display text-4xl font-semibold tracking-tight text-[#F7F9FC] sm:text-5xl lg:text-6xl">
            {BRAND_NAME}
          </p>
          <h1 className="landing-fade-up landing-fade-up-delay-1 mt-4 font-display text-3xl font-medium leading-tight tracking-tight text-[#F7F9FC] sm:text-4xl lg:text-[2.75rem]">
            {HERO_HEADLINE}
          </h1>
          <p className="landing-fade-up landing-fade-up-delay-2 mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#98A5B7] sm:text-lg lg:mx-0">
            {HERO_SUBHEAD}
          </p>
          <p className="landing-fade-up landing-fade-up-delay-2 mt-4 hidden font-display text-lg text-[#98A5B7] lg:block">
            {HERO_OS_LINE}
          </p>
          <div className="landing-fade-up landing-fade-up-delay-3 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href="/register"
              className={buttonClassName({ size: "lg", className: "w-full sm:w-auto" })}
            >
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
          <p className="landing-fade-up landing-fade-up-delay-3 mt-5 text-sm text-[#98A5B7]">
            No credit card · {TRIAL_DAYS}-day Pro trial · Your Twin belongs to you
          </p>
        </div>

        <div className="landing-fade-up landing-fade-up-delay-2 flex justify-center lg:justify-end">
          <LandingHeroPhoneDemo />
        </div>
      </div>
    </section>
  );
}

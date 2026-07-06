import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/button";
import {
  FINAL_CTA_BUTTON,
  FINAL_CTA_HEADLINE,
  FINAL_CTA_SUBHEAD,
  TRIAL_DAYS,
} from "@/lib/marketing-copy";

export function LandingCta() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="landing-cta-panel relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 landing-hero-glow opacity-60" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {FINAL_CTA_HEADLINE}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-forward-300">{FINAL_CTA_SUBHEAD}</p>
            <Link href="/register" className="mt-8 inline-block">
              <Button size="lg">
                {FINAL_CTA_BUTTON}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-forward-400">
              {TRIAL_DAYS}-day free trial · No credit card required
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

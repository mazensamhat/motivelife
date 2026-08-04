import Link from "next/link";
import { Apple, ArrowRight, Smartphone } from "lucide-react";
import { buttonClassName } from "@/components/button";
import {
  APP_STORE_CTA,
  FINAL_CTA_BUTTON,
  FINAL_CTA_HEADLINE,
  FINAL_CTA_SUBHEAD,
  PLAN_PRICE_CAD,
  PLAY_STORE_CTA,
  TRIAL_DAYS,
} from "@/lib/marketing-copy";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/motive-family";

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
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/register" className={buttonClassName({ size: "lg" })}>
                {FINAL_CTA_BUTTON}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({
                  size: "lg",
                  variant: "secondary",
                  className:
                    "border border-white/15 bg-white/10 text-white hover:bg-white/15",
                })}
              >
                <Apple className="mr-2 h-4 w-4" aria-hidden />
                {APP_STORE_CTA}
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({
                  size: "lg",
                  variant: "secondary",
                  className:
                    "border border-white/15 bg-white/10 text-white hover:bg-white/15",
                })}
              >
                <Smartphone className="mr-2 h-4 w-4" aria-hidden />
                {PLAY_STORE_CTA}
              </a>
            </div>
            <p className="mt-4 text-sm text-forward-400">
              {TRIAL_DAYS}-day free trial · Pro {PLAN_PRICE_CAD} · Family $19.99 · Family Pro
              Upgrade $9.99 · App Store
              & Google Play
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

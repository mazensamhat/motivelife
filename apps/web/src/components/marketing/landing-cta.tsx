import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/button";
import { TRIAL_DAYS } from "@/lib/marketing";

export function LandingCta() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="landing-cta-panel relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 landing-hero-glow opacity-60" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Your next chapter starts with one clear step
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-forward-300">
              Join MotiveLife and get a partner that remembers your goals, briefs you every
              morning, and keeps you moving forward.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <Button size="lg">
                Start {TRIAL_DAYS}-day free trial
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Mic,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/button";
import { MARKETING_TAGLINE, TRIAL_DAYS } from "@/lib/marketing";

export function LandingHero() {
  return (
    <section className="landing-hero-bg relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 landing-hero-glow" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-forward-200">
            <Sparkles className="h-3.5 w-3.5 text-brand-cyan" aria-hidden />
            {MARKETING_TAGLINE}
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            Stop juggling apps.
            <span className="mt-1 block brand-gradient-text">Start moving your life forward.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-forward-300">
            One place for your goals, habits, career, money, and health — with an AI partner that
            remembers everything and tells you exactly what to do next.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start {TRIAL_DAYS}-day free trial
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="secondary"
                className="w-full border border-white/15 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
              >
                Sign in
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
          <div className="landing-product-frame rounded-2xl border border-white/10 bg-forward-900/80 p-4 shadow-2xl backdrop-blur-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-forward-400">
                  Good morning
                </p>
                <p className="mt-1 text-lg font-semibold text-white">Your daily briefing</p>
              </div>
              <span className="rounded-full brand-accent-gradient px-2.5 py-1 text-xs font-semibold text-forward-950">
                +12 Life Score
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-forward-950/60 p-4">
              <p className="text-sm leading-relaxed text-forward-200">
                Today&apos;s mission: finish the portfolio update and send one networking message.
                You&apos;re 2 tasks from your weekly career goal.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Career", "Goals", "Habits"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-forward-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Career", score: 72, color: "bg-brand-blue" },
                { label: "Health", score: 58, color: "bg-brand-cyan" },
                { label: "Money", score: 81, color: "bg-brand-green" },
              ].map((domain) => (
                <div
                  key={domain.label}
                  className="rounded-lg border border-white/10 bg-forward-950/40 p-3 text-center"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-forward-400">
                    {domain.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">{domain.score}</p>
                  <div className="mx-auto mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${domain.color}`}
                      style={{ width: `${domain.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-brand-purple/30 bg-brand-purple/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Next action</p>
                <p className="text-xs text-forward-300">Update portfolio — ~25 min</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full brand-gradient shadow-lg">
                <Mic className="h-4 w-4 text-white" aria-hidden />
              </div>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-2 hidden rounded-lg border border-white/10 bg-forward-900 px-3 py-2 text-xs text-forward-300 shadow-xl sm:block">
            Voice organize → tasks & goals
          </div>
        </div>
      </div>
    </section>
  );
}

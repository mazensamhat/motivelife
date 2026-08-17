"use client";

import { ArrowUp, ArrowRight, Check, AlertTriangle } from "lucide-react";
import { LIFEVUE_WEEK } from "@/lib/marketing-copy";
import { cn } from "@/lib/utils";

const TONE_ICON = {
  up: { Icon: ArrowUp, label: "Improving", className: "text-[#A3E635]" },
  ok: { Icon: Check, label: "Stable", className: "text-[#2DD4BF]" },
  watch: { Icon: AlertTriangle, label: "Watch", className: "text-[#FB923C]" },
} as const;

export function LandingLifeVueRing() {
  return (
    <section
      id="dashboard"
      className="scroll-mt-24 border-y border-white/[0.06] bg-[#0D1420] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#98A5B7]">
          LifeVue
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-[#F7F9FC] sm:text-5xl">
          Your life, at a glance.
        </h2>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
            <div
              className="lifevue-ring absolute inset-0 rounded-full opacity-90"
              aria-hidden
            />
            <div className="relative flex flex-col items-center text-center">
              <p className="font-display text-6xl font-bold tabular-nums text-[#F7F9FC] sm:text-7xl">
                {LIFEVUE_WEEK.score}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#98A5B7]">
                Life Momentum
              </p>
            </div>

            {LIFEVUE_WEEK.summary.map((item, i) => {
              const tone = TONE_ICON[item.tone];
              const angles = [-90, -18, 54, 126, 198];
              const rad = (angles[i]! * Math.PI) / 180;
              const r = 118;
              const x = Math.cos(rad) * r;
              const y = Math.sin(rad) * r;
              return (
                <div
                  key={item.domain}
                  className="absolute flex items-center gap-1 rounded-full ml-glass px-2.5 py-1.5 text-xs font-medium text-[#F7F9FC]"
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                >
                  <span className="text-[#98A5B7]">{item.domain}</span>
                  <tone.Icon className={cn("h-3.5 w-3.5", tone.className)} aria-label={tone.label} />
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="font-display text-2xl font-semibold text-[#F7F9FC] sm:text-3xl">
              {LIFEVUE_WEEK.headline}
            </h3>
            <ul className="mt-6 space-y-3">
              {LIFEVUE_WEEK.summary.map((item) => {
                const tone = TONE_ICON[item.tone];
                return (
                  <li key={item.domain} className="flex gap-3 text-base text-[#98A5B7]">
                    <tone.Icon
                      className={cn("mt-0.5 h-4 w-4 shrink-0", tone.className)}
                      aria-hidden
                    />
                    <span>{item.line}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#67E8F9]">
              Ask VYRA about my week
              <ArrowRight className="h-4 w-4" aria-hidden />
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { LIVE_PHONE_SCENARIOS } from "@/lib/marketing-copy";
import { cn } from "@/lib/utils";

export function LandingLivePhone() {
  const [index, setIndex] = useState(0);
  const scenario = LIVE_PHONE_SCENARIOS[index]!;

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LIVE_PHONE_SCENARIOS.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <div className="landing-product-frame relative overflow-hidden rounded-[2rem] border-[3px] border-forward-700 bg-forward-950 shadow-2xl">
        <div className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-forward-800" aria-hidden />
        <div className="relative min-h-[420px] bg-forward-900/95 px-4 pb-5 pt-10">
          <div className="absolute inset-0 landing-hero-glow opacity-40" aria-hidden />

          <div
            key={scenario.id}
            className="relative animate-[fadeIn_0.6s_ease-out]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-cyan">
              {scenario.day}
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{scenario.greeting}</p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-forward-300">
                Life Score
              </span>
              <span className="text-sm font-bold text-brand-green">{scenario.lifeScore}</span>
            </div>

            <ul className="mt-5 space-y-2.5">
              {scenario.lines.map((line) => (
                <li
                  key={line}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-snug text-forward-100"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {LIVE_PHONE_SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Show ${s.greeting}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-6 bg-brand-cyan" : "w-1.5 bg-forward-600"
            )}
          />
        ))}
      </div>
    </div>
  );
}

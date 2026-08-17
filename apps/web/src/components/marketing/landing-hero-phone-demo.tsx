"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  HERO_TODAY_CARDS,
  HERO_VYRA_LINE,
} from "@/lib/marketing-copy";
import { MARKETING_MODULE_COLOR } from "@/lib/marketing-palette";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const TIMING = {
  greeting: 0,
  cards: 900,
  cardStagger: 450,
  vyra: 3200,
  osLine: 4800,
} as const;

function StatusIcon({ status }: { status: "good" | "neutral" }) {
  if (status === "good") {
    return (
      <Check className="h-3.5 w-3.5 shrink-0 text-[#A3E635]" aria-hidden />
    );
  }
  return null;
}

export function LandingHeroPhoneDemo() {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState(reduced ? 4 : 0);

  useEffect(() => {
    if (reduced) return;
    const timers = [
      window.setTimeout(() => setPhase(1), TIMING.greeting),
      window.setTimeout(() => setPhase(2), TIMING.cards),
      window.setTimeout(() => setPhase(3), TIMING.vyra),
      window.setTimeout(() => setPhase(4), TIMING.osLine),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  const showCards = phase >= 2;
  const showVyra = phase >= 3;
  const showOs = phase >= 4;

  return (
    <div
      className="relative mx-auto w-full max-w-[300px]"
      aria-live="polite"
      aria-label="MotiveLife daily briefing demo"
    >
      <div className="landing-product-frame relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0D1420] shadow-2xl">
        <div
          className="absolute left-1/2 top-2.5 z-10 h-1 w-14 -translate-x-1/2 rounded-full bg-white/10"
          aria-hidden
        />
        <div className="relative min-h-[440px] px-4 pb-5 pt-11">
          <div className="pointer-events-none absolute inset-0 landing-hero-glow opacity-25" aria-hidden />

          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#98A5B7]">
            Good afternoon
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-[#F7F9FC]">
            Here&apos;s what matters now.
          </p>

          <div className="mt-5 space-y-2">
            {HERO_TODAY_CARDS.map((card, i) => {
              const accent = MARKETING_MODULE_COLOR[card.id];
              const visible = reduced || (showCards && phase >= 2);
              return (
                <div
                  key={card.id}
                  className={cn(
                    "ml-glass rounded-xl px-3 py-2.5 motion-interface transition-all",
                    visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                  )}
                  style={
                    visible && !reduced
                      ? { animationDelay: `${i * TIMING.cardStagger}ms` }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: accent }}
                      >
                        {card.name}
                      </p>
                      <p
                        className="mt-0.5 font-display text-xl font-semibold tabular-nums"
                        style={{ color: accent }}
                      >
                        {card.value}
                      </p>
                      <p className="text-xs text-[#98A5B7]">{card.label}</p>
                    </div>
                    <StatusIcon status={card.status} />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "mt-4 ml-glass rounded-xl border border-[#A78BFA]/25 px-3 py-3 motion-interface transition-all",
              showVyra ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            )}
          >
            <div className="flex gap-2.5">
              <div className="vyra-orb mt-0.5 h-7 w-7 shrink-0 rounded-full" aria-hidden />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A78BFA]">
                  VYRA
                </p>
                <p className="mt-1 text-sm leading-snug text-[#F7F9FC]">{HERO_VYRA_LINE}</p>
              </div>
            </div>
          </div>

          <p
            className={cn(
              "mt-5 text-center font-display text-sm font-medium text-[#98A5B7] motion-interface transition-all",
              showOs ? "opacity-100" : "opacity-0",
            )}
          >
            One AI Life Operating System.
          </p>
        </div>
      </div>
    </div>
  );
}

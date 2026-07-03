"use client";

import { useEffect, useState } from "react";
import type { LifeXpPayload } from "@forward/shared";
import { cn } from "@/lib/utils";
import { useAnimatedNumber } from "@/hooks/use-animated-number";

function AnimatedXpBar({ width, color, delayMs }: { width: number; color: string; delayMs: number }) {
  const [w, setW] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setW(width), delayMs);
    return () => window.clearTimeout(id);
  }, [width, delayMs]);

  return (
    <div
      className="h-full rounded-full transition-all duration-700 ease-out"
      style={{ width: `${w}%`, backgroundColor: color }}
    />
  );
}

export function LifeXpPanel({ xp, compact = false }: { xp: LifeXpPayload; compact?: boolean }) {
  const active = xp.dimensions.filter((d) => d.totalXp > 0);
  const display = compact ? active.slice(0, 4) : active.slice(0, 8);
  const totalXp = active.reduce((sum, d) => sum + d.totalXp, 0);
  const animatedTotal = useAnimatedNumber(totalXp, 1400);

  if (display.length === 0) {
    return (
      <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Life XP™</p>
        <p className="mt-2 text-sm text-forward-600">
          Complete tasks, Life Engine actions, and coaching challenges to build capability — not points for
          points&apos; sake.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-forward-200 bg-white shadow-sm">
      <div className="border-b border-forward-100 bg-gradient-to-r from-forward-50 to-white px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Life XP™</p>
            <h2 className="mt-1 text-lg font-semibold text-forward-900">{xp.headline}</h2>
            <p className="mt-1 text-sm text-forward-500">{xp.subheadline}</p>
            {totalXp > 0 ? (
              <p className="mt-2 text-2xl font-bold tabular-nums text-brand-green">
                {animatedTotal.toLocaleString()} XP
              </p>
            ) : null}
          </div>
          {!compact && xp.recentGains[0] && (
            <p className="rounded-full bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-green">
              Latest: +{xp.recentGains[0].amount} {xp.recentGains[0].reason}
            </p>
          )}
        </div>
      </div>

      <div className={cn("grid gap-3 p-5 sm:p-6", compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
        {display.map((d, i) => (
          <div key={d.id} className="rounded-xl border border-forward-100 bg-forward-50/50 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-forward-800">{d.label}</p>
              {d.recentGain > 0 && (
                <span className="text-[10px] font-bold text-brand-green">+{d.recentGain}</span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-forward-400">{d.capability}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forward-200">
              <AnimatedXpBar width={d.progressToNext} color={d.color} delayMs={80 + i * 100} />
            </div>
            <p className="mt-1.5 text-[10px] tabular-nums text-forward-400">{d.totalXp} XP total</p>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import type { DomainScoreMap } from "@forward/shared";
import { cn } from "@/lib/utils";
import {
  LIFE_MOMENTUM_DOMAINS,
  domainStatusLabel,
  momentumTrendLabel,
} from "@/lib/digital-twin";
import { useAnimatedNumber } from "@/hooks/use-animated-number";

function Bar({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-forward-100", className)}>
      <div
        className="h-full rounded-full bg-brand-cyan transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

/** Life Momentum dashboard — blueprint Life Dashboard (not tasks/notes). */
export function LifeMomentumPanel({
  scores,
  twinConfidence,
}: {
  scores: DomainScoreMap;
  twinConfidence?: { percent: number; nextHint: string };
}) {
  const animated = useAnimatedNumber(scores.overall, 1200);
  const trend = momentumTrendLabel(scores.overallDelta);

  return (
    <section className="rounded-2xl border border-forward-200 bg-gradient-to-br from-white via-forward-50/80 to-brand-cyan/5 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
            Life Momentum
          </p>
          <p className="mt-1 text-sm text-forward-600">
            How your living Digital Twin sees the trajectory of your life — today.
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums tracking-tight text-forward-900">
            {animated}
            <span className="text-lg font-semibold text-forward-400">%</span>
          </p>
          <p
            className={cn(
              "mt-1 text-xs font-semibold uppercase tracking-wide",
              scores.overallDelta > 0
                ? "text-brand-green"
                : scores.overallDelta < 0
                  ? "text-red-500"
                  : "text-forward-500"
            )}
          >
            {trend}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {LIFE_MOMENTUM_DOMAINS.map(({ key, label }) => {
          const score = scores[key];
          const delta = scores.domainDeltas[key];
          const status = domainStatusLabel(score, delta);
          return (
            <div
              key={key}
              className="rounded-xl border border-forward-100 bg-white/80 px-3 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-forward-900">{label}</p>
                <p className="text-sm font-bold tabular-nums text-forward-800">{score}%</p>
              </div>
              <Bar score={score} className="mt-2" />
              <p className="mt-1.5 text-[11px] font-medium text-forward-500">{status}</p>
            </div>
          );
        })}
      </div>

      {twinConfidence ? (
        <div className="mt-5 rounded-xl border border-dashed border-brand-cyan/40 bg-brand-cyan/5 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
              Twin prediction confidence
            </p>
            <p className="text-sm font-bold tabular-nums text-forward-900">
              {twinConfidence.percent}%
            </p>
          </div>
          <Bar score={twinConfidence.percent} className="mt-2" />
          <p className="mt-2 text-xs text-forward-600">{twinConfidence.nextHint}</p>
        </div>
      ) : null}
    </section>
  );
}

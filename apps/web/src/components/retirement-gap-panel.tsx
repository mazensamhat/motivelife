"use client";

import type { RetirementGapPayload } from "@/lib/retirement-gap";
import { cn } from "@/lib/utils";

export function RetirementGapPanel({
  gap,
  compact = false,
}: {
  gap: RetirementGapPayload;
  compact?: boolean;
}) {
  if (!gap.show) return null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        gap.onTrack
          ? "border-brand-green/30 bg-gradient-to-br from-brand-green/5 to-white"
          : "border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white"
      )}
    >
      <div className={cn("px-5 py-5", compact ? "sm:px-6" : "sm:px-8 sm:py-6")}>
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          Retirement GPS
        </p>
        <h2
          className={cn(
            "mt-1 font-semibold text-forward-900",
            compact ? "text-lg" : "text-xl sm:text-2xl"
          )}
        >
          {gap.headline}
        </h2>
        <p className="mt-2 text-sm text-forward-600">{gap.detail}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Saved", value: format(gap.currentSaved) },
            { label: "Target", value: format(gap.targetNestEgg) },
            { label: "Monthly", value: format(gap.monthlyNeeded) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white/80 px-2 py-2 text-center sm:px-3 sm:py-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-forward-400">{stat.label}</p>
              <p className="text-sm font-bold tabular-nums text-forward-900 sm:text-base">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-forward-400">{gap.scienceNote}</p>
      </div>
    </section>
  );
}

function format(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

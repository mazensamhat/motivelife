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

  const target = gap.retireAge;
  const projected = gap.projectedRetirementAge;
  const minAge = Math.min(target, projected) - 2;
  const maxAge = Math.max(target, projected) + 2;
  const span = maxAge - minAge || 1;
  const targetPct = ((target - minAge) / span) * 100;
  const projectedPct = ((projected - minAge) / span) * 100;

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

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-forward-500">Retirement target</p>
            <p className="text-3xl font-bold tabular-nums text-forward-900">{target}</p>
            <p className="text-sm text-forward-500">years old</p>
          </div>
          <div>
            <p className="text-xs text-forward-500">Current projection</p>
            <p
              className={cn(
                "text-3xl font-bold tabular-nums",
                gap.onTrack ? "text-brand-green" : "text-amber-600"
              )}
            >
              {projected}
            </p>
            <p className="text-sm text-forward-500">at today&apos;s pace</p>
          </div>
        </div>

        {!gap.onTrack && gap.yearsEarlierWithExtra > 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-forward-700">
            If you save{" "}
            <strong className="text-forward-900">
              {formatMoney(gap.extraMonthlySavings)}/month more
            </strong>
            , you could retire{" "}
            <strong className="text-brand-green">{gap.yearsEarlierWithExtra} years earlier</strong>.
          </p>
        ) : (
          <p className="mt-4 text-sm text-forward-600">{gap.detail}</p>
        )}

        <div className="mt-5">
          <div className="relative h-3 overflow-hidden rounded-full bg-forward-100">
            <div
              className="absolute top-0 h-full w-1 rounded-full bg-brand-green"
              style={{ left: `${targetPct}%` }}
              title={`Target: ${target}`}
            />
            <div
              className={cn(
                "absolute top-0 h-full w-1.5 rounded-full",
                gap.onTrack ? "bg-brand-green" : "bg-amber-500"
              )}
              style={{ left: `${projectedPct}%` }}
              title={`Projection: ${projected}`}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-medium text-forward-400">
            <span>{minAge}</span>
            <span>Target {target}</span>
            <span>{maxAge}</span>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-forward-400">{gap.scienceNote}</p>
      </div>
    </section>
  );
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

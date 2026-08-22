"use client";

import type { VitaluScore } from "@forward/shared";

/** Semi-circle Vital Score gauge matching the Vitalu console template. */
export function VitaluScoreGauge({
  score,
  size = 240,
  accent = "var(--vitalu-mint)",
  compact = false,
}: {
  score: VitaluScore;
  size?: number;
  accent?: string;
  /** Hide the component grid — used when breakdown is shown as a caption under the gauge. */
  compact?: boolean;
}) {
  const total = score.total;
  const width = size;
  const height = size * 0.62;
  const cx = width / 2;
  const cy = height - 8;
  const r = width * 0.4;
  const stroke = Math.max(12, width * 0.055);
  const half = Math.PI * r;
  const pct = total != null ? Math.max(0, Math.min(100, total)) / 100 : 0;
  const dash = half * pct;
  const gap = half - dash;

  const byKey = Object.fromEntries(score.components.map((c) => [c.key, c]));
  const movement = byKey.movement?.score;
  const recovery = byKey.recovery?.score;
  const consistency = byKey.consistency?.score;
  const nutrition = byKey.nutrition?.score;
  const missing: string[] = [];
  if (nutrition == null) missing.push("Nutrition");
  if (movement == null) missing.push("Movement");
  if (recovery == null) missing.push("Recovery");

  const trendLabel =
    score.trend === "up"
      ? "Rising"
      : score.trend === "down"
        ? "Easing"
        : score.trend === "steady"
          ? "Steady"
          : "Building";

  return (
    <div className={compact ? "flex flex-col items-center" : "flex flex-col items-center gap-3"}>
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#e8edf3"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vitalu-muted)]">
            Vital Score
          </p>
          <p className="font-display text-4xl font-semibold tabular-nums leading-none text-[var(--vitalu-mint-ink)]">
            {total != null ? total : "—"}
            <span className="ml-1 text-base font-medium text-[var(--vitalu-muted)]">/ 100</span>
          </p>
          <p className="mt-1 text-xs font-semibold capitalize text-[var(--vitalu-muted)]">{trendLabel}</p>
        </div>
      </div>
      {!compact ? (
        <p className="max-w-xs text-center text-xs leading-relaxed text-[var(--vitalu-muted)]">
          Movement {movement ?? "—"} · Recovery {recovery ?? "—"} · Consistency {consistency ?? "—"}
          {missing.length ? ` · Missing: ${missing.join(", ")}` : ""}
        </p>
      ) : null}
    </div>
  );
}

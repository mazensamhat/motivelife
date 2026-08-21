"use client";

import type { VitaluScore } from "@forward/shared";

/** Circular Vital Score gauge with Movement / Recovery / Consistency / Nutrition. */
export function VitaluScoreGauge({
  score,
  size = 220,
  accent = "#15803d",
}: {
  score: VitaluScore;
  size?: number;
  accent?: string;
}) {
  const total = score.total;
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(10, size * 0.055);
  const circ = 2 * Math.PI * r;
  const pct = total != null ? Math.max(0, Math.min(100, total)) / 100 : 0;
  const dash = circ * pct;
  const gap = circ - dash;

  const byKey = Object.fromEntries(score.components.map((c) => [c.key, c]));
  const ringKeys = [
    { key: "movement" as const, label: "Movement", color: "#0d9488" },
    { key: "recovery" as const, label: "Recovery", color: "#2563eb" },
    { key: "consistency" as const, label: "Consistency", color: "#7c3aed" },
    { key: "nutrition" as const, label: "Nutrition", color: "#ca8a04" },
  ];
  const trendLabel =
    score.trend === "up"
      ? "rising"
      : score.trend === "down"
        ? "easing"
        : score.trend === "steady"
          ? "steady"
          : "building";

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e7e5e4" strokeWidth={stroke} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forward-500">Vital Score</p>
          <p className="font-display text-5xl font-semibold tabular-nums text-forward-950">
            {total != null ? total : "—"}
          </p>
          <p className="mt-0.5 text-xs capitalize text-forward-500">{trendLabel}</p>
        </div>
      </div>
      <ul className="grid w-full max-w-xs grid-cols-2 gap-2">
        {ringKeys.map(({ key, label, color }) => {
          const c = byKey[key];
          const v = c?.score ?? null;
          return (
            <li key={key} className="rounded-xl border border-forward-100 bg-white/80 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-forward-500">
                  {label}
                </span>
              </div>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-forward-900">
                {v != null ? v : "—"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

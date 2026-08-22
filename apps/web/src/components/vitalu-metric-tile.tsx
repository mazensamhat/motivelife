"use client";

import { cn } from "@/lib/utils";

const TONES = {
  mint: {
    bg: "linear-gradient(165deg, #ecfdf5 0%, #ffffff 62%)",
    bar: "var(--vitalu-mint)",
    ink: "var(--vitalu-mint-ink)",
  },
  sky: {
    bg: "linear-gradient(165deg, #e0f2fe 0%, #ffffff 62%)",
    bar: "var(--vitalu-sky)",
    ink: "#0c4a6e",
  },
  lavender: {
    bg: "linear-gradient(165deg, #ede9fe 0%, #ffffff 62%)",
    bar: "var(--vitalu-lavender-ink)",
    ink: "#4c1d95",
  },
  apricot: {
    bg: "linear-gradient(165deg, #ffedd5 0%, #ffffff 62%)",
    bar: "var(--vitalu-apricot)",
    ink: "#9a3412",
  },
  coral: {
    bg: "linear-gradient(165deg, #ffe4e6 0%, #ffffff 62%)",
    bar: "var(--vitalu-coral)",
    ink: "#9f1239",
  },
} as const;

export type VitaluMetricTone = keyof typeof TONES;

/** Pastel summary tile matching the Vitalu template top row. */
export function VitaluMetricTile({
  label,
  value,
  hint,
  tone,
  progress,
  glyph,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone: VitaluMetricTone;
  progress?: number | null;
  glyph?: string;
  className?: string;
}) {
  const t = TONES[tone];
  const pct =
    progress == null || !Number.isFinite(progress)
      ? null
      : Math.max(0, Math.min(100, progress));

  return (
    <div
      className={cn(
        "vitalu-tile relative overflow-hidden rounded-[1.35rem] border border-white/80 p-4 shadow-[var(--vitalu-shadow)]",
        className
      )}
      style={{ background: t.bg }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: t.ink }}>
          {label}
        </p>
        {glyph ? (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70 text-base shadow-sm"
            aria-hidden
          >
            {glyph}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-[var(--vitalu-ink)] sm:text-[1.65rem]">
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-[var(--vitalu-muted)]">{hint}</div> : null}
      {pct != null ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, background: t.bar }}
          />
        </div>
      ) : null}
    </div>
  );
}

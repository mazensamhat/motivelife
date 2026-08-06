"use client";

import { driveScoreBand, type DriveScoreBand } from "@forward/shared";

const BAND_LABEL: Record<DriveScoreBand, string> = {
  safe: "Safe",
  caution: "Caution",
  review: "Review",
};

/**
 * Big bubbly Drive Score — color + motion follow severity.
 * safe ≥85 · caution 70–84 · review <70
 */
export function DriveScoreBubble({
  score,
  size = "md",
  showLabel = true,
  className = "",
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  if (score == null || !Number.isFinite(score)) {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center rounded-full bg-forward-100 text-forward-400 ${sizeClass(size)} ${className}`}
      >
        <span className={`font-display font-bold tabular-nums ${numClass(size)}`}>
          —
        </span>
        {showLabel ? (
          <span className="text-[9px] font-semibold uppercase tracking-wide">
            Score
          </span>
        ) : null}
      </div>
    );
  }

  const band = driveScoreBand(Math.round(score));
  const n = Math.round(score);

  return (
    <div
      className={`family-score-bubble family-score-bubble--${band} inline-flex flex-col items-center justify-center rounded-full ${sizeClass(size)} ${className}`}
      title={`Drive Score ${n} · ${BAND_LABEL[band]}`}
    >
      <span
        className={`family-score-bubble__num font-display font-bold tabular-nums leading-none ${numClass(size)}`}
      >
        {n}
      </span>
      {showLabel ? (
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-80">
          {BAND_LABEL[band]}
        </span>
      ) : null}
    </div>
  );
}

function sizeClass(size: "sm" | "md" | "lg") {
  if (size === "lg") return "h-[4.75rem] w-[4.75rem]";
  if (size === "sm") return "h-11 w-11";
  return "h-14 w-14";
}

function numClass(size: "sm" | "md" | "lg") {
  if (size === "lg") return "text-3xl";
  if (size === "sm") return "text-base";
  return "text-2xl";
}

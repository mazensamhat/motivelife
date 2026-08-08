"use client";

import type { FamilyAreaIntel, FamilyDriveImpact } from "@forward/shared";

/**
 * Always-visible weather + road-feel strip on Family Map.
 * Does not wait for adverse conditions — clear days still show the read.
 */
export function MapConditionsBar({
  areaIntel,
  driveImpact,
  onOpenInsights,
}: {
  areaIntel: FamilyAreaIntel | null | undefined;
  driveImpact?: FamilyDriveImpact | null;
  onOpenInsights?: () => void;
}) {
  const weather = areaIntel?.weather ?? null;
  const traffic = areaIntel?.traffic ?? null;
  if (!weather && !traffic && !driveImpact) return null;

  const weatherLabel = weather
    ? `${weather.summary} · ${weather.tempC}°C`
    : "Weather…";
  const trafficLabel =
    driveImpact?.events?.find((e) => e.kind === "traffic")?.title ??
    (traffic?.level === "slow"
      ? "Slower roads"
      : traffic?.level === "clear"
        ? "Roads clear"
        : traffic?.summary
          ? traffic.summary.length > 28
            ? "Road feel"
            : traffic.summary
          : "Road feel…");

  const wet = Boolean(
    weather &&
      (weather.severe || weather.precipMm >= 0.4 || weather.code >= 51)
  );
  const slow =
    traffic?.level === "slow" ||
    Boolean(driveImpact?.events?.some((e) => e.kind === "traffic"));

  return (
    <div className="pointer-events-auto flex justify-center px-1">
      <button
        type="button"
        onClick={onOpenInsights}
        className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/96 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-forward-800 shadow-md ring-1 ring-forward-100 max-[420px]:text-[10px] sm:gap-2.5 sm:px-3 sm:text-xs"
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-white"
          style={{
            background: wet
              ? "linear-gradient(160deg,#7dd3fc,#0ea5e9)"
              : "linear-gradient(160deg,#a5b4fc,#6366f1)",
          }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90"
            aria-hidden
          />
          <span className="truncate max-w-[7.5rem] sm:max-w-[10rem]">
            {weatherLabel}
          </span>
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-white"
          style={{
            background: slow
              ? "linear-gradient(160deg,#fca5a5,#ef4444)"
              : "linear-gradient(160deg,#6ee7b7,#10b981)",
          }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90"
            aria-hidden
          />
          <span className="truncate max-w-[7rem] sm:max-w-[9rem]">
            {trafficLabel}
          </span>
        </span>
        {driveImpact?.etaDeltaMin && driveImpact.etaDeltaMin > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800 ring-1 ring-amber-100">
            +{driveImpact.etaDeltaMin} min
          </span>
        ) : null}
      </button>
    </div>
  );
}

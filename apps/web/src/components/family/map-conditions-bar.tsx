"use client";

import type { FamilyAreaIntel, FamilyDriveImpact } from "@forward/shared";
import { isElevatedAirQuality } from "@/lib/family-map/air-quality";

/**
 * Compact adverse-only strip — weather / traffic / air when they matter.
 * Calm clear-sky / roads-clear / air-fine reads stay on map blurbs only.
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
  const air = areaIntel?.airQuality ?? null;

  const wet = Boolean(
    weather &&
      (weather.severe || weather.precipMm >= 0.4 || weather.code >= 51)
  );
  const slow =
    traffic?.level === "slow" ||
    Boolean(
      driveImpact?.events?.some(
        (e) => e.kind === "traffic" && e.severity !== "info"
      )
    );
  const roadHit = Boolean(
    driveImpact?.events?.some((e) =>
      ["construction", "accident", "closure", "hazard"].includes(e.kind)
    )
  );
  const airHit = Boolean(air && isElevatedAirQuality(air));

  // Nothing useful to say — stay off the chrome (orbs / route carry the story).
  if (
    !wet &&
    !slow &&
    !roadHit &&
    !airHit &&
    !(driveImpact && driveImpact.etaDeltaMin > 0)
  ) {
    return null;
  }

  const weatherLabel = wet && weather
    ? `${weather.summary} · ${weather.tempC}°C`
    : null;
  const trafficEvent = driveImpact?.events?.find(
    (e) =>
      e.kind === "traffic" ||
      e.kind === "construction" ||
      e.kind === "accident" ||
      e.kind === "closure"
  );
  const trafficLabel = slow
    ? trafficEvent?.title ?? "Slower roads"
    : roadHit
      ? trafficEvent?.title ?? "Road alert"
      : null;
  const airLabel = airHit && air
    ? `${air.category} · AQI ${air.aqi}`
    : null;

  return (
    <div className="pointer-events-auto flex justify-center px-1">
      <button
        type="button"
        onClick={onOpenInsights}
        className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/96 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-forward-800 shadow-md ring-1 ring-forward-100 max-[420px]:text-[10px] sm:gap-2.5 sm:px-3 sm:text-xs"
      >
        {weatherLabel ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-white"
            style={{
              background: "linear-gradient(160deg,#7dd3fc,#0ea5e9)",
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
        ) : null}
        {airLabel ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-white"
            style={{
              background:
                air?.severity === "warning"
                  ? "linear-gradient(160deg,#fde047,#ca8a04)"
                  : "linear-gradient(160deg,#bef264,#65a30d)",
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90"
              aria-hidden
            />
            <span className="truncate max-w-[8rem] sm:max-w-[11rem]">
              {airLabel}
            </span>
          </span>
        ) : null}
        {trafficLabel ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-white"
            style={{
              background: slow
                ? "linear-gradient(160deg,#fca5a5,#ef4444)"
                : "linear-gradient(160deg,#fdba74,#f97316)",
            }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90"
              aria-hidden
            />
            <span className="truncate max-w-[8rem] sm:max-w-[11rem]">
              {trafficLabel}
            </span>
          </span>
        ) : null}
        {driveImpact?.etaDeltaMin && driveImpact.etaDeltaMin > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800 ring-1 ring-amber-100">
            +{driveImpact.etaDeltaMin} min
          </span>
        ) : null}
      </button>
    </div>
  );
}

"use client";

import type { FamilyAreaIntel, FamilyDriveImpact } from "@forward/shared";
import { isElevatedAirQuality } from "@/lib/family-map/air-quality";
import { KINZO_INTEL_BUBBLE, KINZO_UI } from "@/lib/family-map/ui-theme";
import {
  Car,
  Cloud,
  CloudRain,
  Construction,
  Sparkles,
  Sun,
  Wind,
} from "lucide-react";

/**
 * Persistent KINZO conditions strip — weather, air, and road feel stay on-map.
 * Adverse reads get stronger tint; clear days still show the live read so the
 * map feels alive (not empty chrome).
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
  const airHit = Boolean(
    air && (isElevatedAirQuality(air) || air.level === "moderate")
  );
  const combined =
    driveImpact &&
    (driveImpact.events?.filter((e) => e.severity !== "info").length ?? 0) >= 2;

  if (!weather && !air && !traffic && !driveImpact) return null;

  const weatherLabel = weather
    ? `${weather.summary || "Weather"} · ${weather.tempC}°C`
    : null;

  const trafficEvent = driveImpact?.events?.find(
    (e) =>
      e.kind === "traffic" ||
      e.kind === "construction" ||
      e.kind === "accident" ||
      e.kind === "closure"
  );
  const trafficLabel = slow
    ? trafficEvent?.title
      ? `${trafficEvent.title}${
          trafficEvent.etaDeltaMin
            ? ` · +${trafficEvent.etaDeltaMin} min`
            : ""
        }`
      : "Heavy traffic"
    : roadHit
      ? trafficEvent?.title ?? "Road condition"
      : trafficEvent?.title && trafficEvent.severity === "info"
        ? trafficEvent.title === "Clear"
          ? "Roads clear"
          : trafficEvent.title
        : traffic?.level === "clear"
          ? "Roads clear"
          : traffic?.level === "slow"
            ? "Slower roads"
            : driveImpact
              ? "Road feel"
              : null;

  const airLabel = air
    ? airHit
      ? `Air · AQI ${air.aqi}`
      : `AQI ${air.aqi}`
    : null;

  const combinedLabel =
    combined && driveImpact
      ? `${driveImpact.events.filter((e) => e.severity !== "info").length} conditions ahead · expected +${Math.round(driveImpact.etaDeltaMin || 0)} min`
      : null;

  const WeatherIcon = wet ? CloudRain : weather && weather.code >= 2 ? Cloud : Sun;

  return (
    <div className="pointer-events-auto flex justify-center px-1">
      <button
        type="button"
        onClick={onOpenInsights}
        className={`${KINZO_INTEL_BUBBLE} max-w-full flex-wrap gap-2`}
        aria-label="Open area conditions"
      >
        {combinedLabel ? (
          <span
            className="inline-flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-forward-900"
            style={{
              background: "color-mix(in srgb, #8B5CF6 12%, white)",
              borderLeft: `3px solid ${KINZO_UI.intel}`,
            }}
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: KINZO_UI.intel }}
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="truncate text-left leading-tight">{combinedLabel}</span>
          </span>
        ) : null}
        {weatherLabel ? (
          <span
            className="inline-flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-sky-950"
            style={{
              background: wet
                ? "color-mix(in srgb, #0EA5E9 18%, white)"
                : "color-mix(in srgb, #0EA5E9 10%, white)",
              borderLeft: `3px solid ${KINZO_UI.weather}`,
            }}
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: KINZO_UI.weather }}
            >
              <WeatherIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="truncate text-left leading-tight">{weatherLabel}</span>
          </span>
        ) : null}
        {airLabel ? (
          <span
            className="inline-flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-lime-950"
            style={{
              background: airHit
                ? "color-mix(in srgb, #84cc16 18%, white)"
                : "color-mix(in srgb, #84cc16 10%, white)",
              borderLeft: "3px solid #65a30d",
            }}
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-600 text-white">
              <Wind className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
            <span className="truncate text-left leading-tight">{airLabel}</span>
          </span>
        ) : null}
        {trafficLabel ? (
          <span
            className="inline-flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-forward-900"
            style={{
              background: slow
                ? "color-mix(in srgb, #EF4444 14%, white)"
                : roadHit
                  ? "color-mix(in srgb, #F97316 14%, white)"
                  : "color-mix(in srgb, #22C55E 12%, white)",
              borderLeft: `3px solid ${
                slow
                  ? KINZO_UI.traffic
                  : roadHit
                    ? KINZO_UI.construction
                    : "#22C55E"
              }`,
            }}
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
              style={{
                background: slow
                  ? KINZO_UI.traffic
                  : roadHit
                    ? "#F97316"
                    : "#16A34A",
              }}
            >
              {slow || !roadHit ? (
                <Car className="h-3.5 w-3.5" strokeWidth={2.4} />
              ) : (
                <Construction className="h-3.5 w-3.5" strokeWidth={2.4} />
              )}
            </span>
            <span className="truncate text-left leading-tight">{trafficLabel}</span>
          </span>
        ) : null}
        {driveImpact?.etaDeltaMin && driveImpact.etaDeltaMin > 0 ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-100">
            +{driveImpact.etaDeltaMin} min
          </span>
        ) : null}
      </button>
    </div>
  );
}

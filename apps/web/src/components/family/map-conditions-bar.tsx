"use client";

import type { FamilyAreaIntel, FamilyDriveImpact } from "@forward/shared";
import { isElevatedAirQuality } from "@/lib/family-map/air-quality";
import { KINZO_UI } from "@/lib/family-map/ui-theme";
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
 * Tiny map condition orbs — round icon on top, short label under.
 * Only while someone is moving so the idle map stays clear.
 */
export function MapConditionsBar({
  areaIntel,
  driveImpact,
  someoneMoving = false,
  onOpenInsights,
}: {
  areaIntel: FamilyAreaIntel | null | undefined;
  driveImpact?: FamilyDriveImpact | null;
  /** Hide entirely when the household is settled. */
  someoneMoving?: boolean;
  onOpenInsights?: () => void;
}) {
  if (!someoneMoving) return null;

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

  const weatherLabel = weather ? `${weather.tempC}°` : null;
  const airLabel = air ? String(air.aqi) : null;

  const trafficEvent = driveImpact?.events?.find(
    (e) =>
      e.kind === "traffic" ||
      e.kind === "construction" ||
      e.kind === "accident" ||
      e.kind === "closure"
  );
  const trafficLabel = slow
    ? "Slow"
    : roadHit
      ? trafficEvent?.kind === "construction"
        ? "Work"
        : "Road"
      : driveImpact
        ? "Clear"
        : null;

  const etaLabel =
    driveImpact?.etaDeltaMin && driveImpact.etaDeltaMin > 0
      ? `+${Math.round(driveImpact.etaDeltaMin)}`
      : null;

  const WeatherIcon = wet
    ? CloudRain
    : weather && weather.code >= 2
      ? Cloud
      : Sun;

  const chips: Array<{
    key: string;
    label: string;
    title: string;
    color: string;
    icon: typeof Sun;
    hot?: boolean;
  }> = [];

  if (combined && driveImpact) {
    chips.push({
      key: "combined",
      label: etaLabel ?? `${driveImpact.events.filter((e) => e.severity !== "info").length}`,
      title: "Conditions ahead",
      color: KINZO_UI.intel,
      icon: Sparkles,
      hot: true,
    });
  }
  if (weatherLabel) {
    chips.push({
      key: "weather",
      label: weatherLabel,
      title: weather?.summary
        ? `${weather.summary} · ${weather.tempC}°C`
        : "Weather",
      color: KINZO_UI.weather,
      icon: WeatherIcon,
      hot: wet,
    });
  }
  if (airLabel) {
    chips.push({
      key: "air",
      label: airLabel,
      title: air ? `Air · AQI ${air.aqi}` : "Air quality",
      color: "#65a30d",
      icon: Wind,
      hot: airHit,
    });
  }
  if (trafficLabel) {
    chips.push({
      key: "traffic",
      label: trafficLabel,
      title: slow ? "Heavy traffic" : roadHit ? "Road condition" : "Roads clear",
      color: slow ? KINZO_UI.traffic : roadHit ? KINZO_UI.construction : "#16A34A",
      icon: roadHit && !slow ? Construction : Car,
      hot: slow || roadHit,
    });
  }
  if (!combined && etaLabel) {
    chips.push({
      key: "eta",
      label: etaLabel,
      title: `+${driveImpact?.etaDeltaMin} min vs clear`,
      color: "#d97706",
      icon: Sparkles,
      hot: true,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="pointer-events-auto flex justify-center px-1">
      <button
        type="button"
        onClick={onOpenInsights}
        className="inline-flex max-w-full items-end gap-2 rounded-full bg-white/70 px-2 py-1.5 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] ring-1 ring-white/80 backdrop-blur-md"
        aria-label="Open area conditions"
      >
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <span
              key={chip.key}
              title={chip.title}
              className="flex w-11 flex-col items-center gap-0.5"
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white/90"
                style={{
                  background: chip.color,
                  boxShadow: chip.hot
                    ? `0 6px 14px -4px color-mix(in srgb, ${chip.color} 55%, transparent)`
                    : undefined,
                }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span className="max-w-full truncate text-center text-[9px] font-bold leading-none tracking-tight text-forward-800">
                {chip.label}
              </span>
            </span>
          );
        })}
      </button>
    </div>
  );
}

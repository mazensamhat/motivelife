"use client";

import { Gauge, Phone, Siren, Zap } from "lucide-react";

/**
 * Life360-style drive event icon strip — we show real counts (not locked).
 * Phone usage is reserved until we have a signal; shown as “soon”.
 */
export function DriveEventsStrip({
  maxSpeedKmh,
  hardBraking,
  rapidAcceleration,
  unusualRouteEvents,
  compact = false,
}: {
  maxSpeedKmh: number;
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  compact?: boolean;
}) {
  const items = [
    {
      key: "top",
      label: "Top speed",
      value: `${Math.round(maxSpeedKmh)}`,
      unit: "km/h",
      tone: "bg-forward-900 text-white",
      icon: <Gauge className="h-3.5 w-3.5" />,
    },
    {
      key: "brake",
      label: "Hard braking",
      value: String(hardBraking),
      unit: hardBraking === 1 ? "event" : "events",
      tone:
        hardBraking > 0
          ? "bg-amber-100 text-amber-900"
          : "bg-forward-100 text-forward-700",
      icon: <Siren className="h-3.5 w-3.5" />,
    },
    {
      key: "accel",
      label: "Rapid accel",
      value: String(rapidAcceleration),
      unit: rapidAcceleration === 1 ? "event" : "events",
      tone:
        rapidAcceleration > 0
          ? "bg-orange-100 text-orange-900"
          : "bg-forward-100 text-forward-700",
      icon: <Zap className="h-3.5 w-3.5" />,
    },
    {
      key: "unusual",
      label: "Unusual",
      value: String(unusualRouteEvents),
      unit: unusualRouteEvents === 1 ? "event" : "events",
      tone:
        unusualRouteEvents > 0
          ? "bg-rose-100 text-rose-900"
          : "bg-forward-100 text-forward-700",
      icon: <Siren className="h-3.5 w-3.5" />,
    },
    {
      key: "phone",
      label: "Phone",
      value: "—",
      unit: "soon",
      tone: "bg-forward-50 text-forward-400",
      icon: <Phone className="h-3.5 w-3.5" />,
    },
  ] as const;

  return (
    <div
      className={`grid grid-cols-5 gap-1.5 ${compact ? "" : "sm:gap-2"}`}
      role="list"
      aria-label="Drive events"
    >
      {items.map((item) => (
        <div
          key={item.key}
          role="listitem"
          className={`flex flex-col items-center rounded-xl px-1 py-2 text-center ${item.tone}`}
          title={item.label}
        >
          <span className="mb-1 opacity-80">{item.icon}</span>
          <span className={`font-semibold tabular-nums ${compact ? "text-xs" : "text-sm"}`}>
            {item.value}
          </span>
          <span className="mt-0.5 text-[9px] font-medium leading-tight opacity-80">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { Gauge, Phone, Siren, Zap, X } from "lucide-react";
import { DRIVE_EVENT_EXPLAINERS, sanitizeSpeedKmh } from "@forward/shared";
import { countSeverity } from "@/lib/family-map/ui-theme";

type EventKey = keyof typeof DRIVE_EVENT_EXPLAINERS;

/**
 * Life360-style drive event icon strip — real counts, tap for plain-language explanation.
 * Bubbly tiles animate by severity.
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
  const [open, setOpen] = useState<EventKey | null>(null);
  const safeTop = Math.round(sanitizeSpeedKmh(maxSpeedKmh) ?? 0);

  const items: {
    key: EventKey;
    value: string;
    severity: "calm" | "watch" | "alert";
    icon: ReactNode;
  }[] = [
    {
      key: "topSpeed",
      value: safeTop > 0 ? `${safeTop}` : "—",
      severity: safeTop >= 130 ? "alert" : safeTop >= 115 ? "watch" : "calm",
      icon: <Gauge className="h-4 w-4" />,
    },
    {
      key: "hardBraking",
      value: String(hardBraking),
      severity: countSeverity(hardBraking),
      icon: <Siren className="h-4 w-4" />,
    },
    {
      key: "rapidAccel",
      value: String(rapidAcceleration),
      severity: countSeverity(rapidAcceleration),
      icon: <Zap className="h-4 w-4" />,
    },
    {
      key: "unusual",
      value: String(unusualRouteEvents),
      severity: countSeverity(unusualRouteEvents),
      icon: <Siren className="h-4 w-4" />,
    },
    {
      key: "phone",
      value: "—",
      severity: "calm",
      icon: <Phone className="h-4 w-4" />,
    },
  ];

  const explainer = open ? DRIVE_EVENT_EXPLAINERS[open] : null;

  return (
    <div className="space-y-2">
      <div
        className={`grid grid-cols-5 gap-1.5 ${compact ? "" : "sm:gap-2"}`}
        role="list"
        aria-label="Drive events — tap a tile for explanation"
      >
        {items.map((item) => {
          const meta = DRIVE_EVENT_EXPLAINERS[item.key];
          return (
            <button
              key={item.key}
              type="button"
              role="listitem"
              onClick={() => setOpen((v) => (v === item.key ? null : item.key))}
              className={`family-count-tile family-count-tile--${item.severity} flex flex-col items-center px-1 py-2.5 text-center ring-offset-2 ${
                open === item.key ? "ring-2 ring-brand-blue" : ""
              }`}
              title={`${meta.title} — tap for details`}
              aria-expanded={open === item.key}
            >
              <span className="mb-1 opacity-80">{item.icon}</span>
              <span
                className={`family-count-tile__value ${
                  compact ? "text-base" : "text-xl"
                } leading-none`}
              >
                {item.value}
              </span>
              <span className="mt-1 text-[9px] font-semibold leading-tight opacity-75">
                {meta.title}
              </span>
            </button>
          );
        })}
      </div>

      {explainer ? (
        <div className="rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-forward-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-forward-900">
                {explainer.title}
              </p>
              <p className="mt-0.5 text-xs font-medium text-forward-700">
                {explainer.short}
              </p>
              <p className="mt-1.5 text-xs leading-snug text-forward-600">
                {explainer.detail}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-forward-100 p-1.5 text-forward-600"
              aria-label="Close explanation"
              onClick={() => setOpen(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-[10px] text-forward-400">
          Tap any tile for what it means
        </p>
      )}
    </div>
  );
}

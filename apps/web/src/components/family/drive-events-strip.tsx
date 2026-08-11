"use client";

import { useState, type ReactNode } from "react";
import { Gauge, Phone, X } from "lucide-react";
import { DRIVE_EVENT_EXPLAINERS, sanitizeSpeedKmh } from "@forward/shared";
import { countSeverity } from "@/lib/family-map/ui-theme";

type EventKey = "topSpeed" | "phone";

/**
 * Drive event strip — trustworthy signals only.
 * Hard brake / rapid accel / unusual are paused (phone GPS noise).
 */
export function DriveEventsStrip({
  maxSpeedKmh,
  phoneUsageEvents = 0,
  compact = false,
}: {
  maxSpeedKmh: number;
  /** @deprecated ignored — aggressive GPS telematics paused */
  hardBraking?: number;
  /** @deprecated ignored — aggressive GPS telematics paused */
  rapidAcceleration?: number;
  /** @deprecated ignored — aggressive GPS telematics paused */
  unusualRouteEvents?: number;
  phoneUsageEvents?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<EventKey | null>(null);
  const safeTop = Math.round(sanitizeSpeedKmh(maxSpeedKmh) ?? 0);

  const items: {
    key: EventKey;
    kind: "speed" | "phone";
    value: string;
    severity: "calm" | "watch" | "alert";
    icon: ReactNode;
  }[] = [
    {
      key: "topSpeed",
      kind: "speed",
      value: safeTop > 0 ? `${safeTop}` : "—",
      severity: safeTop >= 130 ? "alert" : safeTop >= 115 ? "watch" : "calm",
      icon: <Gauge className="h-4 w-4" />,
    },
    {
      key: "phone",
      kind: "phone",
      value: phoneUsageEvents > 0 ? String(phoneUsageEvents) : "—",
      severity: countSeverity(phoneUsageEvents),
      icon: <Phone className="h-4 w-4" />,
    },
  ];

  const explainer = open ? DRIVE_EVENT_EXPLAINERS[open] : null;

  return (
    <div className="space-y-2">
      <div
        className={`grid grid-cols-2 gap-2 ${compact ? "" : "sm:gap-2.5"}`}
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
              className={`family-count-tile family-count-tile--${item.severity} family-count-tile--kind-${item.kind} flex flex-col items-center text-center ring-offset-2 ${
                open === item.key ? "ring-2 ring-forward-900" : ""
              }`}
              title={`${meta.title} — tap for details`}
              aria-expanded={open === item.key}
            >
              <span className="family-count-tile__icon">{item.icon}</span>
              <span
                className={`family-count-tile__value mt-1.5 ${
                  compact ? "text-xl" : "text-2xl"
                } leading-none`}
              >
                {item.value}
              </span>
              <span className="family-count-tile__label">{meta.title}</span>
            </button>
          );
        })}
      </div>

      {explainer ? (
        <div className="rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-forward-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-forward-950">
                {explainer.title}
              </p>
              <p className="mt-0.5 text-xs font-bold text-forward-800">
                {explainer.short}
              </p>
              <p className="mt-1.5 text-xs font-medium leading-snug text-forward-700">
                {explainer.detail}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-forward-100 p-1.5 text-forward-700"
              aria-label="Close explanation"
              onClick={() => setOpen(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-[10px] font-semibold text-forward-500">
          Tap a tile for what it means
        </p>
      )}
    </div>
  );
}

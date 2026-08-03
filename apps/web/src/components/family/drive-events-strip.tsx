"use client";

import { useState, type ReactNode } from "react";
import { Gauge, Phone, Siren, Zap, X } from "lucide-react";
import { DRIVE_EVENT_EXPLAINERS, sanitizeSpeedKmh } from "@forward/shared";

type EventKey = keyof typeof DRIVE_EVENT_EXPLAINERS;

/**
 * Life360-style drive event icon strip — real counts, tap for plain-language explanation.
 */
export function DriveEventsStrip({
  maxSpeedKmh,
  hardBraking,
  rapidAcceleration,
  unusualRouteEvents,
  phoneUsageEvents = 0,
  compact = false,
}: {
  maxSpeedKmh: number;
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  phoneUsageEvents?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<EventKey | null>(null);
  const safeTop = Math.round(sanitizeSpeedKmh(maxSpeedKmh) ?? 0);
  const phoneCount = Math.max(0, Math.round(phoneUsageEvents));

  const items: {
    key: EventKey;
    value: string;
    tone: string;
    icon: ReactNode;
  }[] = [
    {
      key: "topSpeed",
      value: safeTop > 0 ? `${safeTop}` : "—",
      tone: "bg-forward-900 text-white",
      icon: <Gauge className="h-3.5 w-3.5" />,
    },
    {
      key: "hardBraking",
      value: String(hardBraking),
      tone:
        hardBraking > 0
          ? "bg-amber-100 text-amber-900"
          : "bg-forward-100 text-forward-700",
      icon: <Siren className="h-3.5 w-3.5" />,
    },
    {
      key: "rapidAccel",
      value: String(rapidAcceleration),
      tone:
        rapidAcceleration > 0
          ? "bg-orange-100 text-orange-900"
          : "bg-forward-100 text-forward-700",
      icon: <Zap className="h-3.5 w-3.5" />,
    },
    {
      key: "unusual",
      value: String(unusualRouteEvents),
      tone:
        unusualRouteEvents > 0
          ? "bg-rose-100 text-rose-900"
          : "bg-forward-100 text-forward-700",
      icon: <Siren className="h-3.5 w-3.5" />,
    },
    {
      key: "phone",
      value: String(phoneCount),
      tone:
        phoneCount > 0
          ? "bg-sky-100 text-sky-900"
          : "bg-forward-100 text-forward-700",
      icon: <Phone className="h-3.5 w-3.5" />,
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
              className={`flex flex-col items-center rounded-xl px-1 py-2 text-center transition ring-offset-1 ${
                item.tone
              } ${open === item.key ? "ring-2 ring-brand-blue" : "hover:opacity-90"}`}
              title={`${meta.title} — tap for details`}
              aria-expanded={open === item.key}
            >
              <span className="mb-1 opacity-80">{item.icon}</span>
              <span
                className={`font-semibold tabular-nums ${compact ? "text-xs" : "text-sm"}`}
              >
                {item.value}
              </span>
              <span
                className={`mt-0.5 leading-tight ${
                  compact ? "text-[8px]" : "text-[9px]"
                } opacity-80`}
              >
                {meta.title}
              </span>
            </button>
          );
        })}
      </div>
      {explainer ? (
        <div className="relative rounded-xl border border-forward-200 bg-white px-3 py-2.5 text-left shadow-sm">
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full p-1 text-forward-400 hover:bg-forward-50 hover:text-forward-700"
            aria-label="Close explanation"
            onClick={() => setOpen(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="pr-6 text-sm font-semibold text-forward-900">{explainer.title}</p>
          <p className="mt-0.5 text-xs text-forward-600">{explainer.short}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-forward-500">
            {explainer.detail}
          </p>
        </div>
      ) : null}
    </div>
  );
}

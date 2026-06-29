"use client";

import type { LifeForecastItem } from "@forward/shared";

export function LifeForecastPanel({ items }: { items: LifeForecastItem[] }) {
  return (
    <section className="rounded-2xl border border-brand-cyan/20 bg-gradient-to-br from-forward-50 to-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
        Life Forecast
      </p>
      <p className="mt-1 text-sm text-forward-600">At your current pace, you&apos;ll reach…</p>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 rounded-xl border border-forward-100 bg-white px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-xl">{item.emoji}</span>
              <span className="truncate font-medium text-forward-900">{item.label}</span>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-blue">
              {item.eta}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

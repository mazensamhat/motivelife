"use client";

import type { LifeNotice } from "@forward/shared";

export function AiBriefingInsights({
  insights,
  notices,
}: {
  insights: string[];
  notices: LifeNotice[];
}) {
  const items = [
    ...insights.slice(0, 3),
    ...notices.slice(0, Math.max(0, 3 - insights.length)).map((n) => n.text),
  ].slice(0, 3);

  if (items.length === 0) return null;

  const labels = ["Career", "Money", "Health"];

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Today&apos;s Brief</p>
      <p className="mt-1 text-sm text-forward-500">Three personalized insights for today</p>
      <ul className="mt-4 space-y-3">
        {items.map((text, i) => (
          <li
            key={`${i}-${text.slice(0, 24)}`}
            className="rounded-xl border border-forward-100 bg-forward-50/80 px-4 py-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">
              {labels[i] ?? "Insight"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-forward-800">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

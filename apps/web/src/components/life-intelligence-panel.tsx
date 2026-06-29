"use client";

import type { LifeIntelligencePayload } from "@forward/shared";

export function LifeIntelligencePanel({ data }: { data: LifeIntelligencePayload }) {
  if (data.insights.length === 0) return null;

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
        Life Intelligence
      </p>
      <p className="mt-1 text-sm font-medium text-forward-800">{data.tonightQuestion}</p>
      <ul className="mt-4 space-y-3">
        {data.insights.map((ins) => (
          <li
            key={ins.id}
            className="rounded-xl border border-forward-100 bg-forward-50/80 px-4 py-3 text-sm text-forward-800"
          >
            {ins.insight}
          </li>
        ))}
      </ul>
    </section>
  );
}

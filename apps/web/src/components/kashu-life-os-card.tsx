"use client";

import Link from "next/link";
import type { KashuLifeOsInsight } from "@forward/shared";

const SOURCE_LABEL: Record<KashuLifeOsInsight["source"], string> = {
  kinzo: "KINZO",
  dayo: "DayO",
  uplift: "UPLIFT",
  learning: "Learning",
};

export function KashuLifeOsCard({
  insights,
  compact = false,
}: {
  insights: KashuLifeOsInsight[];
  compact?: boolean;
}) {
  if (!insights.length) return null;
  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Life OS</p>
      <p className="mt-1 text-sm text-forward-600">
        Kashu consults KINZO, DayO, and UPLIFT — it does not copy their jobs.
      </p>
      <ul className="mt-3 space-y-2">
        {insights.slice(0, compact ? 3 : 6).map((item) => (
          <li key={item.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  {SOURCE_LABEL[item.source]}
                </p>
                <p className="text-sm font-semibold text-forward-900">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-forward-600">{item.detail}</p>
              </div>
              {item.verdict ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900 ring-1 ring-emerald-200">
                  {item.verdict}
                </span>
              ) : null}
            </div>
            <Link href={item.href} className="mt-1 inline-block text-xs font-semibold text-emerald-800 hover:underline">
              Open {SOURCE_LABEL[item.source]} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import Link from "next/link";
import type { LifeTimelineEntry } from "@forward/shared";
import { cn } from "@/lib/utils";

export function LifeTimelinePanel({ entries }: { entries: LifeTimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-forward-300 bg-forward-50/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          Life Moments
        </p>
        <p className="mt-2 text-sm text-forward-600">
          Every completed action becomes part of your life — your permanent timeline starts with your first win.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
            Life Moments
          </p>
          <p className="mt-1 text-sm text-forward-500">Your permanent record — milestones that never fade.</p>
        </div>
        <Link href="/memory" className="text-xs font-medium text-brand-blue hover:underline">
          View all →
        </Link>
      </div>
      <ul className="mt-4 space-y-0">
        {entries.map((entry, i) => (
          <li key={entry.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < entries.length - 1 && (
              <span className="absolute left-[4.5rem] top-8 h-full w-px bg-forward-200" />
            )}
            <div className="w-16 shrink-0 text-right">
              <p className="text-xs font-semibold text-forward-500">{entry.dayLabel}</p>
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-forward-100 bg-forward-50/80 px-4 py-3">
              <p className="text-sm font-medium text-forward-900">{entry.title}</p>
            </div>
            <span
              className={cn(
                "shrink-0 self-center text-sm font-bold tabular-nums",
                entry.scoreDelta > 0 ? "text-brand-green" : entry.scoreDelta < 0 ? "text-red-500" : "text-forward-400"
              )}
            >
              {entry.scoreDelta > 0 ? `+${entry.scoreDelta}` : entry.scoreDelta}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

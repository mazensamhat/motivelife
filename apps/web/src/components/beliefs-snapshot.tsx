"use client";

import Link from "next/link";
import type { LifeBelief, LifePreference } from "@forward/shared";

export function BeliefsSnapshot({
  beliefs,
  preferences,
}: {
  beliefs: LifeBelief[];
  preferences?: LifePreference | null;
}) {
  if (beliefs.length === 0 && !preferences) return null;

  const styleLabel =
    preferences?.reminderStyle === "direct"
      ? "Direct coach"
      : preferences?.reminderStyle === "statistics"
        ? "Data-driven coach"
        : "Gentle coach";

  return (
    <section className="rounded-2xl border border-forward-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
            Your AI knows you
          </p>
          {beliefs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {beliefs.slice(0, 4).map((b) => (
                <span
                  key={b.id}
                  className="rounded-full border border-brand-blue/20 bg-brand-blue/5 px-3 py-1 text-xs font-medium text-forward-800"
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {preferences && (
          <p className="text-xs text-forward-500">
            {styleLabel} · {preferences.taskLength} tasks · {preferences.peakHours} peak
          </p>
        )}
      </div>
      <Link href="/settings" className="mt-3 inline-block text-xs font-medium text-brand-blue hover:underline">
        Edit beliefs & preferences →
      </Link>
    </section>
  );
}

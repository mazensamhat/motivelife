"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import type { VoiceWeeklyRecap } from "@forward/shared";

export function VoiceWeeklyRecapPanel() {
  const [recap, setRecap] = useState<VoiceWeeklyRecap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/voice-recap")
      .then((r) => r.json())
      .then((data) => setRecap(data.recap ?? null))
      .catch(() => setRecap(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-28 animate-pulse rounded-xl bg-forward-100" />;
  if (!recap || (recap.captureCount === 0 && recap.practiceCount === 0)) return null;

  return (
    <section className="rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-brand-purple/5 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-brand-purple" />
        <h2 className="text-lg font-semibold text-forward-900">Your voice this week</h2>
      </div>
      <p className="mt-1 text-sm text-forward-500">
        {recap.captureCount + recap.practiceCount} sessions · {recap.nightReflectionCount} evening
        reflection{recap.nightReflectionCount === 1 ? "" : "s"}
        {recap.avgPracticeScore !== null
          ? ` · practice avg ${Math.round(recap.avgPracticeScore)}/100`
          : ""}
      </p>
      <div className="mt-4 space-y-2">
        {recap.paragraphs.map((p) => (
          <p key={p} className="text-sm leading-relaxed text-forward-700">
            {p}
          </p>
        ))}
      </div>
      {recap.topSignals.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recap.topSignals.map((s) => (
            <span
              key={s}
              className="rounded-full bg-forward-100 px-2.5 py-0.5 text-xs font-medium capitalize text-forward-600"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { AiUsageSummary } from "@forward/shared";
import { PLUS_VOICE_ORGANIZE_CAP } from "@forward/shared";

export function AiUsageSettings() {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [tier, setTier] = useState<string>("trial");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai-usage")
      .then((r) => r.json())
      .then((data) => {
        setUsage(data.usage ?? null);
        setTier(data.tier ?? "trial");
      })
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="mt-4 h-20 animate-pulse rounded-xl bg-forward-100" />;
  }

  if (!usage) return null;

  const pct =
    usage.voiceOrganizeCap > 0
      ? Math.min(100, Math.round((usage.voiceOrganizeUnits / usage.voiceOrganizeCap) * 100))
      : 0;

  return (
    <div className="mt-4 rounded-xl border border-forward-200 bg-forward-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">
        AI usage · {usage.monthKey}
      </p>
      <p className="mt-2 text-sm text-forward-800">
        Voice organizes:{" "}
        <span className="font-semibold">
          {usage.voiceOrganizeUnits} / {usage.voiceOrganizeCap}
        </span>{" "}
        this month
        {tier === "trial" && (
          <span className="text-forward-500">
            {" "}
            (trial — upgrade for {PLUS_VOICE_ORGANIZE_CAP} on Pro)
          </span>
        )}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-forward-200">
        <div
          className={`h-full rounded-full transition-all ${usage.atVoiceCap ? "bg-amber-500" : "bg-brand-purple"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {usage.atVoiceCap ? (
        <p className="mt-2 text-xs text-amber-700">
          AI organize limit reached — captures still work with smart rules until next month.
        </p>
      ) : (
        <p className="mt-2 text-xs text-forward-500">
          {usage.voiceOrganizeRemaining} AI organizes left · brain dumps count as 3 · ambient as 2
        </p>
      )}
      <p className="mt-2 text-[10px] text-forward-400">
        Briefing, evening review & weekly letter included · est. API cost $
        {usage.estimatedUsd.toFixed(3)} this month
      </p>
    </div>
  );
}

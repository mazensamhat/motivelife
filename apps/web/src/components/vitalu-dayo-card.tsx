"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VitaluNutritionToday, VitaluScore } from "@forward/shared";
import { readApiJson } from "@/lib/fetch-api";

type Peek = {
  score: VitaluScore;
  nutrition?: VitaluNutritionToday;
  setupComplete: boolean;
  recoveryRecommended?: boolean;
  healthTrend?: string;
};

/** DayO peek — remaining calories / recovery, without duplicating Vitalu. */
export function VitaluDayOCard() {
  const [data, setData] = useState<Peek | null>(null);

  useEffect(() => {
    void fetch("/api/vitalu", { cache: "no-store" })
      .then((r) => readApiJson<Peek>(r))
      .then((d) => {
        if (d?.score) setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;
  if (!data.setupComplete && data.score.total == null) return null;

  const remaining = data.nutrition?.remainingKcal;
  const line = data.recoveryRecommended
    ? "Recovery day — walk and mobility, not a hard session."
    : remaining != null
      ? `${remaining.toLocaleString()} kcal left today`
      : data.setupComplete
        ? "Log a meal or start today’s workout."
        : "Set a wellness plan in Vitalu.";

  return (
    <section className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50/80 via-white to-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-800">Vitalu · today</p>
      <p className="mt-1 text-sm font-semibold text-forward-900">{line}</p>
      <p className="mt-1 text-xs text-forward-600">
        {data.score.total != null ? `Vital Score ${data.score.total}` : "Vital Score —"}
        {data.healthTrend && data.healthTrend !== "Unknown" ? ` · ${data.healthTrend}` : ""}
      </p>
      <Link href="/vitalu" className="mt-2 inline-block text-xs font-semibold text-green-800 hover:underline">
        Open Vitalu →
      </Link>
    </section>
  );
}

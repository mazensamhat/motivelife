"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VitaluDerivedInsight, VitaluScore, VitaluWeightTrend } from "@forward/shared";
import { ProductSuiteIcon } from "@/components/product-icons";
import { readApiJson } from "@/lib/fetch-api";
import { lbFromKg } from "@/lib/vitalu/plan-targets";

type VitaluPeek = {
  score: VitaluScore;
  weight: VitaluWeightTrend;
  setupComplete: boolean;
  profile: { units: "METRIC" | "IMPERIAL" };
  nutrition?: { remainingKcal: number | null };
  healthTrend?: string;
  sleepHoursLastNight?: number | null;
  workoutsCompletedThisWeek?: number;
  derived?: VitaluDerivedInsight;
};

function trendArrow(trend?: string) {
  if (trend === "Improving") return "Improving ↑";
  if (trend === "Slipping") return "Slipping ↓";
  if (trend === "Steady") return "Steady →";
  return "Unknown";
}

/** LifeVue thin health summary — Vitalu owns the engine. */
export function VitaluHealthCard() {
  const [data, setData] = useState<VitaluPeek | null>(null);

  useEffect(() => {
    void fetch("/api/vitalu", { cache: "no-store" })
      .then((r) => readApiJson<VitaluPeek>(r))
      .then((d) => {
        if (d?.score) setData(d);
      })
      .catch(() => {});
  }, []);

  const imperial = data?.profile.units === "IMPERIAL";
  const weightTrend =
    data?.weight.change30dKg != null
      ? `${data.weight.change30dKg < 0 ? "↓" : data.weight.change30dKg > 0 ? "↑" : "→"} ${
          imperial
            ? `${Math.abs(lbFromKg(data.weight.change30dKg)).toFixed(1)} lb`
            : `${Math.abs(data.weight.change30dKg).toFixed(1)} kg`
        }`
      : "Log weight";
  const perWeek = data?.derived?.workoutsPerWeek ?? 0;
  const done = data?.workoutsCompletedThisWeek ?? data?.derived?.workoutsCompletedThisWeek ?? 0;
  const workoutLine = perWeek > 0 ? `${done}/${perWeek} this week` : done > 0 ? `${done} logged` : "Assemble a session";
  const sleep =
    data?.sleepHoursLastNight != null ? `${data.sleepHoursLastNight}h last night` : "Log sleep when you can";
  const nutrition =
    data?.nutrition?.remainingKcal != null
      ? `${data.nutrition.remainingKcal.toLocaleString()} kcal left`
      : "Log a meal";

  return (
    <section className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50/80 via-white to-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
            <ProductSuiteIcon id="vitalu" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-800">Health</p>
            <p className="mt-1 text-lg font-semibold text-forward-900">{trendArrow(data?.healthTrend)}</p>
            <p className="mt-0.5 text-sm text-forward-600">How your health life is doing — Vitalu has the detail.</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-green-900 ring-1 ring-green-200">
          {data?.score.total != null ? `Vital Score ${data.score.total}` : "—"}
        </span>
      </div>
      {data?.setupComplete ? (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-forward-500">Weight trend</dt>
              <dd className="text-sm font-semibold text-forward-900">{weightTrend}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-forward-500">Workout consistency</dt>
              <dd className="text-sm font-semibold text-forward-900">{workoutLine}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-forward-500">Nutrition target</dt>
              <dd className="text-sm font-semibold text-forward-900">{nutrition}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-forward-500">Sleep</dt>
              <dd className="text-sm font-semibold text-forward-900">{sleep}</dd>
            </div>
          </dl>
          {data.derived?.nextAction ? (
            <p className="mt-3 text-sm text-forward-700">{data.derived.nextAction}</p>
          ) : null}
          {data.derived?.correlationInsights[0] ? (
            <p className="mt-2 text-xs text-forward-500">{data.derived.correlationInsights[0].title}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-forward-500">Open Vitalu to set a wellness plan. Connections are optional.</p>
      )}
      <Link href="/vitalu" className="mt-4 inline-block text-sm font-semibold text-green-800 hover:underline">
        Open Vitalu →
      </Link>
    </section>
  );
}

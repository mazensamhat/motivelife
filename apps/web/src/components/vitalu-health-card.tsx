"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VitaluScore, VitaluWeightTrend } from "@forward/shared";
import { PRODUCT_SUITE } from "@/lib/product-suite";
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
};

/** LifeVue thin health summary — Vitalu owns the engine. */
export function VitaluHealthCard() {
  const brand = PRODUCT_SUITE.vitalu;
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
  const trend =
    data?.weight.change30dKg != null
      ? `${data.weight.change30dKg < 0 ? "↓" : data.weight.change30dKg > 0 ? "↑" : "→"} ${
          imperial
            ? `${Math.abs(lbFromKg(data.weight.change30dKg)).toFixed(1)} lb`
            : `${Math.abs(data.weight.change30dKg).toFixed(1)} kg`
        }`
      : null;

  return (
    <section className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50/80 via-white to-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
            <ProductSuiteIcon id="vitalu" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-800">Health</p>
            <p className="mt-1 text-sm text-forward-600">How your health life is doing — Vitalu has the detail.</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-green-900 ring-1 ring-green-200">
          {data?.score.total != null ? `Vital Score ${data.score.total}` : "—"}
        </span>
      </div>
      {data?.setupComplete ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-forward-500">Vital Score</dt>
            <dd className="text-lg font-semibold" style={{ color: brand.primaryDark }}>
              {data.score.total ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-forward-500">Weight trend</dt>
            <dd className="text-lg font-semibold text-forward-900">{trend ?? "Log weight"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-forward-500">Today</dt>
            <dd className="text-sm font-medium text-forward-800">
              {data.nutrition?.remainingKcal != null
                ? `${data.nutrition.remainingKcal.toLocaleString()} kcal left`
                : data.healthTrend && data.healthTrend !== "Unknown"
                  ? data.healthTrend
                  : "Ready"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-forward-500">Open Vitalu to set a wellness plan. Connections are optional.</p>
      )}
      <Link href="/vitalu" className="mt-4 inline-block text-sm font-semibold text-green-800 hover:underline">
        Open Vitalu →
      </Link>
    </section>
  );
}

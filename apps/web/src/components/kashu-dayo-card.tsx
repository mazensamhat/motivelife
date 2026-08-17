"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { KashuForecast, KashuLifeOsInsight } from "@forward/shared";
import { readApiJson } from "@/lib/fetch-api";

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** DayO peek — payday vs calendar, without duplicating Kashu. */
export function KashuDayOCard() {
  const [forecast, setForecast] = useState<KashuForecast | null>(null);

  useEffect(() => {
    void fetch("/api/kashu", { cache: "no-store" })
      .then((r) => readApiJson<{ forecast: KashuForecast }>(r))
      .then((d) => {
        if (d?.forecast) setForecast(d.forecast);
      })
      .catch(() => {});
  }, []);

  if (!forecast) return null;

  const dayo = (forecast.lifeOsInsights ?? []).filter((i: KashuLifeOsInsight) => i.source === "dayo");
  const paydaySoon =
    forecast.daysUntilPayday != null && forecast.daysUntilPayday <= 3;

  if (!paydaySoon && dayo.length === 0) return null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Kashu · today</p>
      <p className="mt-1 text-sm font-semibold text-forward-900">
        {paydaySoon
          ? `Payday in ${forecast.daysUntilPayday}d · Safe to Spend ${money(forecast.safeToSpend)}`
          : `Safe to Spend ${money(forecast.safeToSpend)}`}
      </p>
      {dayo[0] ? <p className="mt-1 text-xs text-forward-600">{dayo[0].detail}</p> : null}
      <Link href="/kashu" className="mt-2 inline-block text-xs font-semibold text-emerald-800 hover:underline">
        Open Kashu →
      </Link>
    </section>
  );
}

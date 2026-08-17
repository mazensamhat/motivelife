"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { KashuForecast } from "@forward/shared";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { ProductSuiteIcon } from "@/components/product-icons";
import { readApiJson } from "@/lib/fetch-api";

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** LifeVue thin financial summary — Kashu owns the engine. */
export function KashuFutureCard() {
  const brand = PRODUCT_SUITE.kashu;
  const [forecast, setForecast] = useState<KashuForecast | null>(null);

  useEffect(() => {
    void fetch("/api/kashu", { cache: "no-store" })
      .then((r) => readApiJson<{ forecast: KashuForecast }>(r))
      .then((d) => {
        if (d?.forecast) setForecast(d.forecast);
      })
      .catch(() => {});
  }, []);

  const status =
    forecast?.status === "red"
      ? "At risk"
      : forecast?.status === "yellow"
        ? "Watch"
        : "Healthy";

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <ProductSuiteIcon id="kashu" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              Financial Future
            </p>
            <p className="mt-1 text-sm text-forward-600">How your financial life is doing — Kashu has the detail.</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
          {forecast ? status : "—"}
        </span>
      </div>
      {forecast ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-forward-500">Safe to Spend</dt>
            <dd className="text-lg font-semibold" style={{ color: brand.primaryDark }}>
              {money(forecast.safeToSpend)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-forward-500">30-day low</dt>
            <dd className="text-lg font-semibold text-forward-900">{money(forecast.projectedLow)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-forward-500">Next risk</dt>
            <dd className="text-sm font-medium text-forward-800">
              {forecast.collisions[0]
                ? `${forecast.collisions[0].title} · ${forecast.collisions[0].date}`
                : "None this horizon"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-forward-500">Open Kashu to set balance, payday, and bills.</p>
      )}
      <Link
        href="/kashu"
        className="mt-4 inline-block text-sm font-semibold text-emerald-800 hover:underline"
      >
        Open Kashu →
      </Link>
    </section>
  );
}

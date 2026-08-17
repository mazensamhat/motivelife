"use client";

import { useEffect, useState } from "react";
import { LifeGpsPanel } from "@/components/life-gps-panel";
import { ProductSuiteIcon } from "@/components/product-icons";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import type { LifeGpsPayload } from "@forward/shared";
import { ResponsivePage } from "@/components/responsive-page";

export function UpliftHome() {
  const brand = PRODUCT_SUITE.uplift;
  const [gps, setGps] = useState<LifeGpsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/life-os", { cache: "no-store" });
      const data = await readApiJson<{ lifeGps: LifeGpsPayload }>(res);
      if (!res.ok || !data) throw new Error(await readApiError(res));
      setGps(data.lifeGps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load UPLIFT.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <ResponsivePage width="module" className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: `color-mix(in srgb, ${brand.primary} 18%, white)` }}
        >
          <ProductSuiteIcon id="uplift" className="h-8 w-8" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: brand.primaryDark }}>
            Goals
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight" style={{ color: brand.primaryDark }}>
            UPLIFT
          </h1>
          <p className="mt-1 max-w-xl text-sm text-forward-600">
            Your destination, milestones, and progress. VYRA can use these goals — it does not own them.
          </p>
        </div>
      </header>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {gps ? (
        <LifeGpsPanel gps={gps} onUpdate={() => void load()} compactGoals={false} />
      ) : (
        <p className="text-sm text-forward-500">Loading your destination…</p>
      )}
    </ResponsivePage>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { LifeFinanceSnapshot } from "@forward/shared";
import { projectWhatIf } from "@forward/shared";
import { Card, CardHeading } from "./card";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type SliderKey = "income" | "invest" | "spending";

const SLIDERS: { key: SliderKey; label: string; min: number; max: number; step: number }[] = [
  { key: "income", label: "Extra monthly income", min: 0, max: 3000, step: 100 },
  { key: "invest", label: "Extra monthly investing", min: 0, max: 2000, step: 50 },
  { key: "spending", label: "Monthly spending cut", min: 0, max: 1500, step: 50 },
];

export function WhatIfSimulator({ snapshot }: { snapshot: LifeFinanceSnapshot }) {
  const [values, setValues] = useState<Record<SliderKey, number>>({
    income: 0,
    invest: 0,
    spending: 0,
  });

  const base = useMemo(() => {
    const currentAge = snapshot.currentAge ?? 40;
    const nestEggTarget = snapshot.nestEggTarget ?? 1_000_000;
    const retirementBalance =
      snapshot.totalRetirement + snapshot.totalInvestments + snapshot.totalSavings * 0.5;
    return {
      monthlyTakeHome: snapshot.monthlyTakeHome,
      fixedMonthlyExpenses: snapshot.fixedMonthlyExpenses,
      monthlyInvestments: snapshot.profile.monthlyInvestments ?? 0,
      retirementBalance,
      nestEggTarget,
      targetRetirementAge: snapshot.retirement?.targetAge ?? snapshot.profile.retirementTargetAge ?? 65,
      currentAge,
    };
  }, [snapshot]);

  const projection = useMemo(
    () =>
      projectWhatIf(base, {
        monthlyIncomeDelta: values.income,
        monthlyInvestmentDelta: values.invest,
        monthlySpendingCut: values.spending,
      }),
    [base, values]
  );

  const baselineAge = snapshot.retirement?.projectedAge ?? projection.projectedRetirementAge;
  const ageDelta = baselineAge - projection.projectedRetirementAge;

  return (
    <div id="what-if">
    <Card className="border-white/10 bg-forward-900 p-5 text-white">
      <CardHeading className="text-sm text-white">What-If Simulator</CardHeading>
      <p className="mt-1 text-xs text-forward-400">
        Drag sliders to see how income, investing, or spending changes affect retirement and cash flow.
      </p>

      <div className="mt-5 space-y-4">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-forward-300">{label}</span>
              <span className="font-semibold tabular-nums text-brand-green">
                {key === "spending" ? "−" : "+"}
                {formatMoney(values[key])}
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
              className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-forward-700 accent-brand-green"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-forward-950/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-500">Available</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-brand-green">
            {formatMoney(projection.availableMonthly)}
          </p>
          <p className="text-xs text-forward-500">/mo after costs</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-forward-950/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-500">Retirement age</p>
          <p
            className={cn(
              "mt-1 text-xl font-bold tabular-nums",
              projection.onTrack ? "text-brand-green" : "text-amber-400"
            )}
          >
            {projection.projectedRetirementAge}
          </p>
          {ageDelta > 0 ? (
            <p className="text-xs text-brand-green">−{ageDelta} yrs vs baseline</p>
          ) : ageDelta < 0 ? (
            <p className="text-xs text-amber-400">+{Math.abs(ageDelta)} yrs vs baseline</p>
          ) : (
            <p className="text-xs text-forward-500">Target {projection.targetRetirementAge}</p>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-forward-950/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-500">Nest egg</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{projection.retirementProgressPercent}%</p>
          <p className="text-xs text-forward-500">toward goal</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-forward-300">{projection.headline}</p>

      {(values.income > 0 || values.invest > 0 || values.spending > 0) && (
        <button
          type="button"
          onClick={() => setValues({ income: 0, invest: 0, spending: 0 })}
          className="mt-3 text-xs font-medium text-brand-cyan hover:underline"
        >
          Reset sliders
        </button>
      )}
    </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { LifeFinanceSnapshot } from "@forward/shared";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const PRESSURE_STYLES = {
  low: { dot: "bg-brand-green", label: "Low pressure", text: "text-brand-green" },
  moderate: { dot: "bg-amber-500", label: "Moderate pressure", text: "text-amber-600" },
  high: { dot: "bg-red-500", label: "High pressure", text: "text-red-600" },
} as const;

function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [monthlyTakeHome, setMonthlyTakeHome] = useState("");
  const [grossAnnualIncome, setGrossAnnualIncome] = useState("");
  const [monthlyInvestments, setMonthlyInvestments] = useState("");
  const [retirementTargetAge, setRetirementTargetAge] = useState("65");

  async function saveProfile(complete: boolean) {
    setBusy(true);
    try {
      await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyTakeHome: monthlyTakeHome ? Number(monthlyTakeHome) : null,
          grossAnnualIncome: grossAnnualIncome ? Number(grossAnnualIncome) : null,
          monthlyInvestments: monthlyInvestments ? Number(monthlyInvestments) : 0,
          retirementTargetAge: retirementTargetAge ? Number(retirementTargetAge) : 65,
          setupComplete: complete,
        }),
      });
      if (complete) onComplete();
      else setStep((s) => s + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-brand-blue/20 bg-gradient-to-br from-brand-blue/5 to-white p-6">
      <CardHeading className="text-lg">Build your Life Financial Profile</CardHeading>
      <p className="mt-2 text-sm text-forward-600">
        Teach your AI how your money works so it can coach career, retirement, goals, and daily
        decisions.
      </p>
      {step === 0 ? (
        <div className="mt-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Step 1 — Income</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Monthly take-home pay</label>
            <Input type="number" placeholder="6800" value={monthlyTakeHome} onChange={(e) => setMonthlyTakeHome(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Annual gross income (optional)</label>
            <Input type="number" placeholder="95000" value={grossAnnualIncome} onChange={(e) => setGrossAnnualIncome(e.target.value)} />
          </div>
          <Button disabled={!monthlyTakeHome || busy} onClick={() => saveProfile(false)}>Continue</Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Step 2 — Investing</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Monthly investments</label>
            <Input type="number" placeholder="800" value={monthlyInvestments} onChange={(e) => setMonthlyInvestments(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Retirement target age</label>
            <Input type="number" value={retirementTargetAge} onChange={(e) => setRetirementTargetAge(e.target.value)} />
          </div>
          <Button disabled={busy} onClick={() => saveProfile(true)}>Finish profile setup</Button>
        </div>
      )}
    </Card>
  );
}

function FinanceDashboard({ snapshot }: { snapshot: LifeFinanceSnapshot }) {
  const pressure = PRESSURE_STYLES[snapshot.lifeCapacity.financialPressure];
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-forward-200 p-0">
        <div className="bg-gradient-to-r from-forward-950 to-forward-900 px-5 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">Life Finance Engine</p>
          <p className="mt-2 text-sm text-forward-200">{snapshot.aiInsight}</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div><p className="text-xs text-forward-500">Take-home</p><p className="text-2xl font-bold">{formatMoney(snapshot.monthlyTakeHome)}</p></div>
          <div><p className="text-xs text-forward-500">Fixed costs</p><p className="text-2xl font-bold">{formatMoney(snapshot.fixedMonthlyExpenses)}</p></div>
          <div><p className="text-xs text-forward-500">Available</p><p className="text-2xl font-bold text-brand-green">{formatMoney(snapshot.availableMonthly)}</p></div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <CardHeading className="text-sm">Life Capacity — Money</CardHeading>
          <p className="mt-2 text-3xl font-bold">{snapshot.lifeCapacity.moneyCapacity}%</p>
          <p className={cn("mt-1 text-sm font-medium", pressure.text)}>{pressure.label}</p>
        </Card>
        <Card className="p-5">
          <CardHeading className="text-sm">Financial Health Score</CardHeading>
          <p className="mt-2 text-3xl font-bold text-brand-blue">{snapshot.moneyHealth.overall}</p>
          <ul className="mt-3 space-y-1 text-sm">{snapshot.moneyHealth.components.map((c) => (<li key={c.key} className="flex justify-between"><span>{c.label}</span><span className="font-semibold">{c.score}</span></li>))}</ul>
        </Card>
      </div>
      {snapshot.retirement ? (
        <Card className="p-5">
          <CardHeading className="text-sm">Retirement — What if?</CardHeading>
          <p className="mt-2 text-sm text-forward-600">{snapshot.retirement.headline}</p>
          <ul className="mt-3 space-y-2">{snapshot.retirement.scenarios.map((s) => (<li key={s.id} className="flex justify-between rounded-lg border px-3 py-2 text-sm"><span>{s.label} · {s.action}</span><span className="font-semibold text-brand-green">{s.impactLabel}</span></li>))}</ul>
        </Card>
      ) : null}
    </div>
  );
}

export function LifeFinanceEnginePanel() {
  const [snapshot, setSnapshot] = useState<LifeFinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const res = await fetch("/api/financial-profile");
    const data = await readApiJson<{ snapshot?: LifeFinanceSnapshot }>(res);
    setSnapshot(data?.snapshot ?? null);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-forward-100" />;
  if (!snapshot?.profile.setupComplete) return <SetupWizard onComplete={load} />;
  return <FinanceDashboard snapshot={snapshot} />;
}

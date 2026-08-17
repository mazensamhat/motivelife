"use client";

import { useEffect, useState } from "react";
import {
  VITALU_ACTIVITY_LABELS,
  VITALU_ACTIVITY_LEVELS,
  VITALU_PLAN_INTENT_LABELS,
  VITALU_PLAN_INTENTS,
  VITALU_WELLNESS_DISCLAIMER,
  type VitaluActivityLevel,
  type VitaluPlanIntent,
  type VitaluProfileFields,
  type VitaluScore,
  type VitaluWeightTrend,
} from "@forward/shared";
import { ProductSuiteIcon } from "@/components/product-icons";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Select } from "@/components/input";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { HealthIntegrationsCard, type HealthIntegrationUiStatus } from "@/components/health-integrations-card";
import { lbFromKg } from "@/lib/vitalu/plan-targets";

type TodayPayload = {
  profile: VitaluProfileFields;
  score: VitaluScore;
  weight: VitaluWeightTrend;
  stepsToday: number | null;
  sleepHoursLastNight: number | null;
  informationalBmi: number | null;
  setupComplete: boolean;
};

function fmtKg(kg: number | null, imperial: boolean) {
  if (kg == null) return "—";
  if (imperial) return `${lbFromKg(kg).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

export function VitaluHome() {
  const brand = PRODUCT_SUITE.vitalu;
  const [data, setData] = useState<TodayPayload | null>(null);
  const [healthSync, setHealthSync] = useState<HealthIntegrationUiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [showBmi, setShowBmi] = useState(false);
  const [intent, setIntent] = useState<VitaluPlanIntent>("LOSE_WEIGHT");
  const [activity, setActivity] = useState<VitaluActivityLevel>("LIGHT");
  const [sex, setSex] = useState<"FEMALE" | "MALE" | "UNSPECIFIED">("UNSPECIFIED");
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("");
  const [units, setUnits] = useState<"METRIC" | "IMPERIAL">("METRIC");
  const [weightLog, setWeightLog] = useState("");

  async function load() {
    setError(null);
    try {
      const [res, syncRes] = await Promise.all([
        fetch("/api/vitalu", { cache: "no-store" }),
        fetch("/api/health/sync", { cache: "no-store" }),
      ]);
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      setData(payload);
      setIntent(payload.profile.planIntent ?? "LOSE_WEIGHT");
      setActivity(payload.profile.activityLevel ?? "LIGHT");
      setSex(payload.profile.biologicalSex ?? "UNSPECIFIED");
      setUnits(payload.profile.units);
      if (payload.profile.heightCm) {
        setHeightCm(
          payload.profile.units === "IMPERIAL"
            ? (payload.profile.heightCm / 2.54).toFixed(1)
            : String(Math.round(payload.profile.heightCm))
        );
      }
      if (payload.profile.currentWeightKg) {
        setWeight(
          payload.profile.units === "IMPERIAL"
            ? lbFromKg(payload.profile.currentWeightKg).toFixed(1)
            : payload.profile.currentWeightKg.toFixed(1)
        );
      }
      const sync = await readApiJson<HealthIntegrationUiStatus>(syncRes);
      setHealthSync(sync);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Vitalu.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const heightRaw = Number(heightCm);
      const w = Number(weight);
      const g = goal ? Number(goal) : null;
      const heightCmVal = units === "IMPERIAL" && heightRaw ? heightRaw * 2.54 : heightRaw || null;
      const currentWeightKg = units === "IMPERIAL" && w ? w / 2.2046226218 : w || null;
      const goalWeightKg = units === "IMPERIAL" && g ? g / 2.2046226218 : g;
      const res = await fetch("/api/vitalu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planIntent: intent,
          activityLevel: activity,
          biologicalSex: sex,
          units,
          heightCm: heightCmVal,
          currentWeightKg,
          goalWeightKg,
          applyProposedTargets: true,
        }),
      });
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save plan.");
    } finally {
      setSaving(false);
    }
  }

  async function logWeight(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(weightLog);
    if (!value) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vitalu/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, unit: units === "IMPERIAL" ? "LB" : "KG" }),
      });
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      setData(payload);
      setWeightLog("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log weight.");
    } finally {
      setSaving(false);
    }
  }

  const imperial = data?.profile.units === "IMPERIAL" || units === "IMPERIAL";

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: `color-mix(in srgb, ${brand.primary} 18%, white)` }}
        >
          <ProductSuiteIcon id="vitalu" className="h-8 w-8" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: brand.primaryDark }}>
            Health Intelligence
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight" style={{ color: brand.primaryDark }}>
            Vitalu
          </h1>
          <p className="mt-1 max-w-xl text-sm text-forward-600">Your Health. Your Plan. Your Life.</p>
        </div>
      </header>

      <p className="rounded-xl border border-green-200 bg-green-50/80 px-4 py-2 text-xs text-green-900">
        {VITALU_WELLNESS_DISCLAIMER}
      </p>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {healthSync ? (
        <HealthIntegrationsCard health={healthSync} returnTo="/vitalu" onChange={() => void load()} />
      ) : null}

      {data ? (
        <>
          <Card className="p-5">
            <button type="button" className="w-full text-left" onClick={() => setShowScore((v) => !v)}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-800">Vital Score</p>
              <p className="mt-1 font-display text-5xl font-semibold" style={{ color: brand.primaryDark }}>
                {data.score.total ?? "—"}
              </p>
              <p className="mt-2 text-sm text-forward-600">{data.score.explanation}</p>
            </button>
            {showScore ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.score.components.map((c) => (
                  <li key={c.key} className="rounded-lg border border-forward-100 bg-forward-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-forward-900">
                      {c.label} {c.score ?? "—"}
                    </span>
                    <p className="mt-0.5 text-xs text-forward-500">{c.reason}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-forward-500">Steps</p>
              <p className="mt-1 text-lg font-semibold text-forward-900">
                {data.stepsToday != null ? Math.round(data.stepsToday).toLocaleString() : "—"}
                {data.profile.stepsTarget ? (
                  <span className="text-sm font-normal text-forward-500">
                    {" "}
                    / {data.profile.stepsTarget.toLocaleString()}
                  </span>
                ) : null}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-forward-500">Sleep last night</p>
              <p className="mt-1 text-lg font-semibold text-forward-900">
                {data.sleepHoursLastNight != null ? `${data.sleepHoursLastNight} h` : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-forward-500">Weight · 7-day avg</p>
              <p className="mt-1 text-lg font-semibold text-forward-900">
                {fmtKg(data.weight.todayKg, imperial)}
                <span className="text-sm font-normal text-forward-500">
                  {" "}
                  · {fmtKg(data.weight.average7dKg, imperial)}
                </span>
              </p>
              {data.weight.change30dKg != null ? (
                <p className="mt-1 text-xs text-forward-500">
                  30-day {data.weight.change30dKg > 0 ? "+" : ""}
                  {fmtKg(Math.abs(data.weight.change30dKg), imperial)}
                  {data.weight.change30dKg < 0 ? " down" : data.weight.change30dKg > 0 ? " up" : ""}
                </p>
              ) : null}
            </Card>
          </div>

          {data.profile.calorieTarget ? (
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Today’s plan</p>
              <p className="mt-2 text-2xl font-semibold text-forward-900">
                {data.profile.calorieTarget.toLocaleString()} kcal
                <span className="ml-2 text-sm font-normal text-forward-500">estimate for general wellness</span>
              </p>
              <p className="mt-2 text-sm text-forward-600">
                Protein {data.profile.proteinTargetG}g · Carbs {data.profile.carbsTargetG}g · Fat{" "}
                {data.profile.fatTargetG}g · Water {data.profile.waterTargetMl} ml · {data.profile.workoutsPerWeek}{" "}
                workouts/week
              </p>
              <p className="mt-3 text-sm text-forward-500">
                Meal logging and the adaptive workout engine ship in the next Vitalu phases. The plan and Vital Score
                already own health — not a generic Health module.
              </p>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="font-display text-xl font-semibold text-forward-900">
              {data.setupComplete ? "Adjust your plan" : "Let’s understand how your health actually works"}
            </h2>
            <form onSubmit={savePlan} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">What should Vitalu help you do?</label>
                <Select value={intent} onChange={(e) => setIntent(e.target.value as VitaluPlanIntent)}>
                  {VITALU_PLAN_INTENTS.map((id) => (
                    <option key={id} value={id}>
                      {VITALU_PLAN_INTENT_LABELS[id]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Typical week</label>
                  <Select value={activity} onChange={(e) => setActivity(e.target.value as VitaluActivityLevel)}>
                    {VITALU_ACTIVITY_LEVELS.map((id) => (
                      <option key={id} value={id}>
                        {VITALU_ACTIVITY_LABELS[id]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Sex (BMR estimate only)</label>
                  <Select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
                    <option value="UNSPECIFIED">Prefer not to say</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Units</label>
                  <Select value={units} onChange={(e) => setUnits(e.target.value as typeof units)}>
                    <option value="METRIC">kg / cm</option>
                    <option value="IMPERIAL">lb / in</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Height ({units === "IMPERIAL" ? "in" : "cm"})</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder={units === "IMPERIAL" ? "70" : "178"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Weight ({units === "IMPERIAL" ? "lb" : "kg"})</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder={units === "IMPERIAL" ? "207" : "94"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Goal (optional)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="optional"
                  />
                </div>
              </div>
              <p className="text-xs text-forward-500">
                Height in imperial is inches. Targets use Mifflin–St Jeor as a wellness estimate — you confirm before
                Vitalu commits.
              </p>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Confirm plan"}
              </Button>
            </form>
            {data.informationalBmi != null ? (
              <div className="mt-4">
                <button
                  type="button"
                  className="text-xs font-medium text-forward-500 underline-offset-2 hover:underline"
                  onClick={() => setShowBmi((v) => !v)}
                >
                  {showBmi ? "Hide" : "Show"} optional informational BMI
                </button>
                {showBmi ? (
                  <p className="mt-1 text-xs text-forward-500">
                    BMI {data.informationalBmi} (kg/m²) is an optional informational metric — not a diagnosis.
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-forward-900">Log weight</h2>
            <p className="mt-1 text-sm text-forward-500">Trends matter more than a single day.</p>
            <form onSubmit={logWeight} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{imperial ? "lb" : "kg"}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={weightLog}
                  onChange={(e) => setWeightLog(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={saving || !weightLog}>
                Save
              </Button>
            </form>
          </Card>
        </>
      ) : !error ? (
        <p className="text-sm text-forward-500">Loading Vitalu…</p>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  VITALU_ACTIVITY_LABELS,
  VITALU_ACTIVITY_LEVELS,
  VITALU_EQUIPMENT,
  VITALU_MEAL_SLOT_LABELS,
  VITALU_MEAL_SLOTS,
  VITALU_PLAN_INTENT_LABELS,
  VITALU_PLAN_INTENTS,
  VITALU_WELLNESS_DISCLAIMER,
  VITALU_WORKOUT_FEEDBACK,
  type VitaluActivityLevel,
  type VitaluCorrelationInsight,
  type VitaluDerivedInsight,
  type VitaluEquipment,
  type VitaluFoodItem,
  type VitaluFoodMemory,
  type VitaluMealSlot,
  type VitaluNutritionToday,
  type VitaluPlanIntent,
  type VitaluProfileFields,
  type VitaluScore,
  type VitaluWeightTrend,
  type VitaluWorkoutFeedback,
  type VitaluWorkoutRow,
  type VitaluWorkoutSession,
} from "@forward/shared";
import { ProductSuiteIcon } from "@/components/product-icons";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Select, Textarea } from "@/components/input";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { HealthIntegrationsCard, type HealthIntegrationUiStatus } from "@/components/health-integrations-card";
import { lbFromKg } from "@/lib/vitalu/plan-targets";

type TodayPayload = {
  profile: VitaluProfileFields;
  score: VitaluScore;
  weight: VitaluWeightTrend;
  nutrition: VitaluNutritionToday;
  foodMemory: VitaluFoodMemory;
  todayWorkout: VitaluWorkoutRow | null;
  stepsToday: number | null;
  sleepHoursLastNight: number | null;
  informationalBmi: number | null;
  setupComplete: boolean;
  recoveryRecommended: boolean;
  healthTrend: "Improving" | "Steady" | "Slipping" | "Unknown";
  workoutsCompletedThisWeek: number;
  calendarPacked: boolean;
  derived: VitaluDerivedInsight;
};

const EQUIPMENT_LABELS: Record<VitaluEquipment, string> = {
  NONE: "No equipment",
  DUMBBELLS: "Dumbbells",
  BANDS: "Bands",
  GYM: "Gym",
  MAT: "Mat",
};

const FEEDBACK_LABELS: Record<VitaluWorkoutFeedback, string> = {
  TOO_EASY: "Too easy",
  PERFECT: "Perfect",
  TOO_HARD: "Too hard",
};

function fmtKg(kg: number | null, imperial: boolean) {
  if (kg == null) return "—";
  if (imperial) return `${lbFromKg(kg).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

function defaultMealSlot(): VitaluMealSlot {
  const h = new Date().getHours();
  if (h < 11) return "BREAKFAST";
  if (h < 15) return "LUNCH";
  if (h < 21) return "DINNER";
  return "SNACK";
}

function correlationTone(severity: VitaluCorrelationInsight["severity"]) {
  if (severity === "good") return "border-green-200 bg-green-50/70 text-green-950";
  if (severity === "watch") return "border-amber-200 bg-amber-50/80 text-amber-950";
  return "border-forward-200 bg-forward-50/80 text-forward-900";
}

function emptyNutrition(): VitaluNutritionToday {
  return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, waterMl: 0, remainingKcal: null, remainingProteinG: null, remainingWaterMl: null, logs: [] };
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

  const [mealSlot, setMealSlot] = useState<VitaluMealSlot>(defaultMealSlot);
  const [foodQuery, setFoodQuery] = useState("");
  const [foodHits, setFoodHits] = useState<VitaluFoodItem[]>([]);
  const [tell, setTell] = useState("");
  const [workoutMinutes, setWorkoutMinutes] = useState("20");
  const [equipment, setEquipment] = useState<VitaluEquipment>("NONE");
  const [askDraft, setAskDraft] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askWorkout, setAskWorkout] = useState<VitaluWorkoutSession | null>(null);

  async function load() {
    setError(null);
    try {
      const [res, syncRes] = await Promise.all([
        fetch("/api/vitalu", { cache: "no-store" }),
        fetch("/api/health/sync", { cache: "no-store" }),
      ]);
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      applyToday(payload);
      const sync = await readApiJson<HealthIntegrationUiStatus>(syncRes);
      setHealthSync(sync);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Vitalu.");
    }
  }

  function applyToday(payload: TodayPayload) {
    setData({
      ...payload,
      nutrition: payload.nutrition ?? emptyNutrition(),
      foodMemory: payload.foodMemory ?? { recent: [], favorites: [], saved: [], usual: {} },
    });
    setIntent(payload.profile.planIntent ?? "LOSE_WEIGHT");
    setActivity(payload.profile.activityLevel ?? "LIGHT");
    setSex(payload.profile.biologicalSex ?? "UNSPECIFIED");
    setUnits(payload.profile.units);
    if (payload.calendarPacked && !payload.todayWorkout) setWorkoutMinutes("15");
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
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const q = foodQuery.trim();
    const t = window.setTimeout(() => {
      void fetch(`/api/vitalu/foods?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => readApiJson<{ foods: VitaluFoodItem[] }>(r))
        .then((d) => setFoodHits(d?.foods ?? []))
        .catch(() => setFoodHits([]));
    }, 180);
    return () => window.clearTimeout(t);
  }, [foodQuery]);

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vitalu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planIntent: intent,
          activityLevel: activity,
          biologicalSex: sex,
          units,
          height: heightCm.trim() || null,
          weight: weight.trim() ? Number(weight) : null,
          goal: goal.trim() ? Number(goal) : null,
          vaultShareLifeGraph: data?.profile.vaultShareLifeGraph,
          vaultShareVyra: data?.profile.vaultShareVyra,
          applyProposedTargets: true,
        }),
      });
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      applyToday(payload);
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
      applyToday(payload);
      setWeightLog("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log weight.");
    } finally {
      setSaving(false);
    }
  }

  async function postFood(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vitalu/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      applyToday(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log food.");
    } finally {
      setSaving(false);
    }
  }

  async function removeFood(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/vitalu/foods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      applyToday(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove food.");
    } finally {
      setSaving(false);
    }
  }

  async function assembleWorkout(extra?: { yoga?: boolean; minutes?: number; equipment?: VitaluEquipment }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vitalu/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: extra?.minutes ?? (Number(workoutMinutes) || 20),
          equipment: extra?.equipment ?? equipment,
          yoga: extra?.yoga,
        }),
      });
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      applyToday(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assemble workout.");
    } finally {
      setSaving(false);
    }
  }

  async function patchWorkout(id: string, patch: { complete?: boolean; feedback?: VitaluWorkoutFeedback }) {
    setSaving(true);
    try {
      const res = await fetch("/api/vitalu/workout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const payload = await readApiJson<TodayPayload>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      applyToday(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update workout.");
    } finally {
      setSaving(false);
    }
  }

  async function askVitalu(e: React.FormEvent) {
    e.preventDefault();
    const message = askDraft.trim();
    if (!message) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vitalu/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = await readApiJson<{ answer: string; workout: VitaluWorkoutSession | null }>(res);
      if (!res.ok || !payload) throw new Error(await readApiError(res));
      setAskAnswer(payload.answer);
      setAskWorkout(payload.workout);
      setAskDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask Vitalu unavailable.");
    } finally {
      setSaving(false);
    }
  }

  const imperial = data?.profile.units === "IMPERIAL" || units === "IMPERIAL";
  const nutrition = data?.nutrition ?? emptyNutrition();
  const remaining = nutrition.remainingKcal;

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

      {data ? (
        <>
          {data.derived?.nextAction ? (
            <p className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-forward-800">
              <span className="font-semibold text-green-800">Next · </span>
              {data.derived.nextAction}
              {data.calendarPacked ? " Calendar looks packed." : ""}
            </p>
          ) : null}
          {data.recoveryRecommended ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Sleep was under 6 hours. Vitalu recommends a recovery day — walk and mobility, not a hard session.
            </p>
          ) : null}

          <Card className="p-5">
            <button type="button" className="w-full text-left" onClick={() => setShowScore((v) => !v)}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-800">Vital Score</p>
              <p className="mt-1 font-display text-5xl font-semibold" style={{ color: brand.primaryDark }}>
                {data.score.total ?? "—"}
              </p>
              <p className="mt-2 text-sm text-forward-600">{data.score.explanation}</p>
              <p className="mt-1 text-xs font-medium text-forward-500">Health trend · {data.healthTrend}</p>
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              {data.derived.provenance?.stepsSources.length ? (
                <p className="mt-1 text-[11px] text-forward-500">
                  {data.derived.provenance.stepsSources.join(" + ")}
                </p>
              ) : null}
            </Card>
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-forward-500">Sleep last night</p>
              <p className="mt-1 text-lg font-semibold text-forward-900">
                {data.sleepHoursLastNight != null ? `${data.sleepHoursLastNight} h` : "—"}
              </p>
              {data.derived.provenance?.sleepSources.length ? (
                <p className="mt-1 text-[11px] text-forward-500">
                  {data.derived.provenance.sleepSources.join(" + ")}
                </p>
              ) : null}
            </Card>
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-forward-500">Active minutes</p>
              <p className="mt-1 text-lg font-semibold text-forward-900">
                {data.derived.activeMinutesToday != null ? Math.round(data.derived.activeMinutesToday) : "—"}
              </p>
              {data.derived.provenance?.activeSources.length ? (
                <p className="mt-1 text-[11px] text-forward-500">
                  {data.derived.provenance.activeSources.join(" + ")}
                </p>
              ) : null}
            </Card>
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-forward-500">Resting HR</p>
              <p className="mt-1 text-lg font-semibold text-forward-900">
                {data.derived.restingHr != null ? `${Math.round(data.derived.restingHr)} bpm` : "—"}
              </p>
              {data.derived.provenance?.restingHrSources.length ? (
                <p className="mt-1 text-[11px] text-forward-500">
                  {data.derived.provenance.restingHrSources.join(" + ")}
                </p>
              ) : null}
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

          {data.derived.correlationInsights.length ? (
            <Card className="p-5 space-y-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-forward-900">Health correlations</h2>
                <p className="mt-1 text-sm text-forward-500">
                  Vitalu merges wearables, KINZO movement, habits, and your logs — then surfaces patterns
                  across sleep, movement, nutrition, and calendar.
                </p>
                {data.derived.provenance?.connectedSources.length ? (
                  <p className="mt-2 text-xs text-forward-500">
                    Today&apos;s signals: {data.derived.provenance.connectedSources.join(", ")}
                  </p>
                ) : null}
              </div>
              <ul className="space-y-2">
                {data.derived.correlationInsights.map((insight) => (
                  <li
                    key={insight.id}
                    className={`rounded-xl border px-4 py-3 text-sm ${correlationTone(insight.severity)}`}
                  >
                    <p className="font-semibold">{insight.title}</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">{insight.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {data.profile.calorieTarget ? (
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Today’s plan</p>
              <p className="mt-2 text-2xl font-semibold text-forward-900">
                {remaining != null ? (
                  <>
                    {remaining.toLocaleString()} kcal left
                    <span className="ml-2 text-sm font-normal text-forward-500">
                      {Math.round(nutrition.kcal).toLocaleString()} / {data.profile.calorieTarget.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    {data.profile.calorieTarget.toLocaleString()} kcal
                    <span className="ml-2 text-sm font-normal text-forward-500">estimate for general wellness</span>
                  </>
                )}
              </p>
              <p className="mt-2 text-sm text-forward-600">
                Protein {Math.round(nutrition.proteinG)}/{data.profile.proteinTargetG}g · Carbs{" "}
                {Math.round(nutrition.carbsG)}/{data.profile.carbsTargetG}g · Fat {Math.round(nutrition.fatG)}/
                {data.profile.fatTargetG}g · Water {nutrition.waterMl}/{data.profile.waterTargetMl} ml
              </p>
              <p className="mt-1 text-xs text-forward-500">
                {data.workoutsCompletedThisWeek}/{data.profile.workoutsPerWeek} workouts this week · food values are
                starter estimates, not a CNF dump
              </p>
              {!data.profile.heightCm || !data.profile.currentWeightKg ? (
                <p className="mt-2 text-xs text-amber-800">
                  Using a typical-adult estimate until you add height and weight.
                </p>
              ) : null}
            </Card>
          ) : null}

          {true ? (
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-forward-900">Log food</h2>
                <p className="mt-1 text-sm text-forward-500">
                  Search, recent, usual meals, Tell Vitalu, copy yesterday. Confirm before it counts.
                  Wearables and phone health sync feed correlated movement and recovery signals.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Search</label>
                  <Input
                    value={foodQuery}
                    onChange={(e) => setFoodQuery(e.target.value)}
                    placeholder="chicken, oats, banana…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Meal</label>
                  <Select value={mealSlot} onChange={(e) => setMealSlot(e.target.value as VitaluMealSlot)}>
                    {VITALU_MEAL_SLOTS.map((id) => (
                      <option key={id} value={id}>
                        {VITALU_MEAL_SLOT_LABELS[id]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              {data.foodMemory?.usual[mealSlot] ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void postFood({ usualSlot: mealSlot })}
                >
                  Add {data.foodMemory.usual[mealSlot]!.label.toLowerCase()} ·{" "}
                  {Math.round(data.foodMemory.usual[mealSlot]!.kcal)} kcal
                </Button>
              ) : null}
              {data.foodMemory && (data.foodMemory.recent.length > 0 || data.foodMemory.favorites.length > 0) ? (
                <div className="space-y-2">
                  {data.foodMemory.favorites.length ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-forward-500">Favorites</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {data.foodMemory.favorites.map((food) => (
                          <button
                            key={`fav-${food.id}`}
                            type="button"
                            disabled={saving}
                            className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-900 ring-1 ring-green-200"
                            onClick={() => void postFood({ catalogId: food.id, mealSlot, grams: food.grams })}
                          >
                            {food.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {data.foodMemory.recent.length ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-forward-500">Recent</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {data.foodMemory.recent.map((food) => (
                          <button
                            key={`recent-${food.id}`}
                            type="button"
                            disabled={saving}
                            className="rounded-full bg-forward-50 px-2.5 py-1 text-xs font-medium text-forward-800 ring-1 ring-forward-200"
                            onClick={() => void postFood({ catalogId: food.id, mealSlot, grams: food.grams })}
                          >
                            {food.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {data.foodMemory.saved.length ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-forward-500">Saved meals</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {data.foodMemory.saved.map((meal) => (
                          <button
                            key={meal.id}
                            type="button"
                            disabled={saving}
                            className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-forward-800 ring-1 ring-forward-200"
                            onClick={() => void postFood({ savedMealId: meal.id, mealSlot })}
                          >
                            {meal.title} · {Math.round(meal.kcal)} kcal
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {foodHits.length ? (
                <ul className="divide-y divide-forward-100 rounded-xl border border-forward-100">
                  {foodHits.map((food) => (
                    <li key={food.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-forward-900">{food.name}</p>
                        <p className="text-xs text-forward-500">
                          {food.servingLabel} · {food.kcal} kcal · P {food.proteinG}g
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => void postFood({ catalogId: food.id, mealSlot, grams: food.grams })}
                      >
                        Log
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!tell.trim()) return;
                  void postFood({ tell: tell.trim(), mealSlot }).then(() => setTell(""));
                }}
              >
                <label className="block text-sm font-medium">Tell Vitalu</label>
                <Textarea
                  rows={2}
                  value={tell}
                  onChange={(e) => setTell(e.target.value)}
                  placeholder="2 eggs, toast with butter, coffee"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={saving || !tell.trim()}>
                    Confirm meal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void postFood({ copyYesterday: true })}
                  >
                    Copy yesterday
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void postFood({ saveMeal: true, mealSlot })}
                  >
                    Save this meal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void postFood({ waterMl: 250, mealSlot })}
                  >
                    +250 ml water
                  </Button>
                </div>
              </form>
              {nutrition.logs.length ? (
                <ul className="space-y-2">
                  {nutrition.logs.map((row) => (
                    <li
                      key={row.logId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-forward-100 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-forward-900">
                          {row.name}{" "}
                          <span className="text-xs font-normal text-forward-500">
                            {VITALU_MEAL_SLOT_LABELS[row.mealSlot]}
                          </span>
                        </p>
                        <p className="text-xs text-forward-500">
                          {Math.round(row.kcal)} kcal · {Math.round(row.grams)} g
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => void removeFood(row.logId)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-forward-500">Nothing logged yet today.</p>
              )}
            </Card>
          ) : null}

          {true ? (
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-forward-900">Today’s workout</h2>
                <p className="mt-1 text-sm text-forward-500">
                  Assembled for you — not a video library. Too easy / perfect / too hard adapts the next one.
                </p>
              </div>
              {!data.todayWorkout ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Minutes</label>
                    <Select value={workoutMinutes} onChange={(e) => setWorkoutMinutes(e.target.value)}>
                      <option value="15">15</option>
                      <option value="20">20</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Equipment</label>
                    <Select value={equipment} onChange={(e) => setEquipment(e.target.value as VitaluEquipment)}>
                      {VITALU_EQUIPMENT.map((id) => (
                        <option key={id} value={id}>
                          {EQUIPMENT_LABELS[id]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="button" disabled={saving} onClick={() => void assembleWorkout()}>
                      Assemble
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => void assembleWorkout({ yoga: true, equipment: "MAT" })}
                    >
                      Yoga
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-lg font-semibold text-forward-900">{data.todayWorkout.session.title}</p>
                  <p className="text-sm text-forward-600">{data.todayWorkout.session.reason}</p>
                  <ol className="space-y-2">
                    {data.todayWorkout.session.blocks.map((block) => (
                      <li key={block.id} className="rounded-lg border border-forward-100 px-3 py-2">
                        <p className="text-sm font-semibold text-forward-900">
                          {block.name}{" "}
                          <span className="font-normal text-forward-500">{block.prescription}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-forward-500">{block.instructions}</p>
                      </li>
                    ))}
                  </ol>
                  {data.todayWorkout.completedAt ? (
                    <p className="text-sm text-green-800">
                      Done
                      {data.todayWorkout.feedback
                        ? ` · ${FEEDBACK_LABELS[data.todayWorkout.feedback]}`
                        : ". How did it feel?"}
                    </p>
                  ) : (
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void patchWorkout(data.todayWorkout!.id, { complete: true })}
                    >
                      Mark complete
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {VITALU_WORKOUT_FEEDBACK.map((id) => (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant={data.todayWorkout?.feedback === id ? "primary" : "secondary"}
                        disabled={saving}
                        onClick={() => void patchWorkout(data.todayWorkout!.id, { complete: true, feedback: id })}
                      >
                        {FEEDBACK_LABELS[id]}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => void assembleWorkout()}
                    >
                      Rebuild
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : null}

          {true ? (
            <Card className="p-5 space-y-3">
              <h2 className="font-display text-xl font-semibold text-forward-900">Ask Vitalu</h2>
              <p className="text-sm text-forward-500">
                Calories left, dinner, a 15-minute workout, noisy weight, or how you’re doing. Wellness only.
              </p>
              <form onSubmit={askVitalu} className="space-y-2">
                <Textarea
                  rows={2}
                  value={askDraft}
                  onChange={(e) => setAskDraft(e.target.value)}
                  placeholder="What’s left to eat today?"
                />
                <Button type="submit" disabled={saving || !askDraft.trim()}>
                  Ask
                </Button>
              </form>
              {askAnswer ? (
                <div className="rounded-xl border border-green-100 bg-green-50/60 px-4 py-3 text-sm text-forward-800">
                  {askAnswer}
                </div>
              ) : null}
              {askWorkout ? (
                <div className="rounded-xl border border-forward-100 px-4 py-3">
                  <p className="text-sm font-semibold text-forward-900">{askWorkout.title}</p>
                  <p className="mt-1 text-xs text-forward-500">{askWorkout.reason}</p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    disabled={saving}
                    onClick={() =>
                      void assembleWorkout({
                        minutes: askWorkout.minutes,
                        equipment: askWorkout.equipment,
                        yoga: /yoga/i.test(askWorkout.title),
                      })
                    }
                  >
                    Save as today’s workout
                  </Button>
                </div>
              ) : null}
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
                  <label className="mb-1 block text-sm font-medium">Height ({units === "IMPERIAL" ? "in or 5.10" : "cm"})</label>
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
                Height: 178 cm, 70 in, or 5.10 (feet.inches). Weight: 94 kg or 207 lb. Body fields are optional —
                without them Vitalu uses a typical-adult estimate you can refine anytime.
              </p>
              <div className="flex flex-col gap-2 text-sm text-forward-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={data.profile.vaultShareLifeGraph}
                    onChange={(e) => {
                      void fetch("/api/vitalu", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ vaultShareLifeGraph: e.target.checked }),
                      })
                        .then((r) => readApiJson<TodayPayload>(r))
                        .then((p) => p && applyToday(p));
                    }}
                  />
                  Share derived health insights with the Life Graph
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={data.profile.vaultShareVyra}
                    onChange={(e) => {
                      void fetch("/api/vitalu", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ vaultShareVyra: e.target.checked }),
                      })
                        .then((r) => readApiJson<TodayPayload>(r))
                        .then((p) => p && applyToday(p));
                    }}
                  />
                  Let VYRA consult Vitalu (derived insights only)
                </label>
              </div>
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

          {healthSync ? (
            <div className="opacity-95">
              <HealthIntegrationsCard health={healthSync} returnTo="/vitalu" onChange={() => void load()} />
            </div>
          ) : null}
        </>
      ) : !error ? (
        <p className="text-sm text-forward-500">Loading Vitalu…</p>
      ) : null}
    </div>
  );
}

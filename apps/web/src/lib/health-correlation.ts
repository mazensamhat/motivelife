/**
 * Merge HealthMetric rows from wearables (Fitbit, Apple Health, Health Connect),
 * inferred sources (KINZO, habits), and voice into one correlated daily view.
 */

import { prisma } from "@forward/database";
import { localDayKey, metricLocalDayKey } from "@/lib/health-day";

export type HealthMetricRow = {
  source: string;
  metricType: string;
  value: number;
  unit: string;
  periodStart: Date;
  externalId?: string | null;
  createdAt?: Date;
};

export type MergedMetricValue = {
  value: number;
  sources: string[];
  strategy: "max_wearable" | "max_all" | "inferred_only" | "voice_fallback";
  bySource: Record<string, number>;
};

export type MergedDailyHealth = {
  dayKey: string;
  steps: MergedMetricValue | null;
  sleepMinutes: MergedMetricValue | null;
  activeMinutes: MergedMetricValue | null;
  restingHr: MergedMetricValue | null;
  connectedSources: string[];
};

export type HealthCorrelationInsight = {
  id: string;
  severity: "info" | "watch" | "good";
  title: string;
  detail: string;
};

const WEARABLE_SOURCES = new Set(["fitbit", "apple_health", "health_connect"]);
const INFERRED_SOURCES = new Set(["habit", "kinzo"]);
const MANUAL_SOURCES = new Set(["voice"]);

function dayKey(d: Date, timeZone?: string) {
  return localDayKey(d, timeZone);
}

export function startOfHealthDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rowsForDay(rows: HealthMetricRow[], day: Date, timeZone?: string): HealthMetricRow[] {
  const key = dayKey(day, timeZone);
  return rows.filter((r) => metricLocalDayKey(r.externalId, r.periodStart) === key);
}

function pickBySource(rows: HealthMetricRow[]): Record<string, number> {
  const bySource: Record<string, number> = {};
  for (const row of rows) {
    const prev = bySource[row.source];
    if (prev == null || row.value > prev) {
      bySource[row.source] = row.value;
    }
  }
  return bySource;
}

function mergeWearableFirst(rows: HealthMetricRow[]): MergedMetricValue | null {
  if (rows.length === 0) return null;
  const bySource = pickBySource(rows);
  const wearableEntries = Object.entries(bySource).filter(([s]) => WEARABLE_SOURCES.has(s));
  const inferredEntries = Object.entries(bySource).filter(([s]) => INFERRED_SOURCES.has(s));
  const manualEntries = Object.entries(bySource).filter(([s]) => MANUAL_SOURCES.has(s));

  if (wearableEntries.length > 0) {
    const best = wearableEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return {
      value: best[1],
      sources: wearableEntries.filter(([, v]) => v === best[1]).map(([s]) => s),
      strategy: "max_wearable",
      bySource,
    };
  }

  if (inferredEntries.length > 0) {
    const best = inferredEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return {
      value: best[1],
      sources: inferredEntries.filter(([, v]) => v === best[1]).map(([s]) => s),
      strategy: "inferred_only",
      bySource,
    };
  }

  if (manualEntries.length > 0) {
    const best = manualEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return {
      value: best[1],
      sources: manualEntries.filter(([, v]) => v === best[1]).map(([s]) => s),
      strategy: "voice_fallback",
      bySource,
    };
  }

  const best = Object.entries(bySource).reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    value: best[1],
    sources: [best[0]],
    strategy: "max_all",
    bySource,
  };
}

function mergeMaxAll(rows: HealthMetricRow[]): MergedMetricValue | null {
  if (rows.length === 0) return null;
  const bySource = pickBySource(rows);
  const best = Object.entries(bySource).reduce((a, b) => (b[1] > a[1] ? b : a));
  const maxVal = best[1];
  return {
    value: maxVal,
    sources: Object.entries(bySource)
      .filter(([, v]) => v === maxVal)
      .map(([s]) => s),
    strategy: "max_all",
    bySource,
  };
}

function mergeSleep(rows: HealthMetricRow[]): MergedMetricValue | null {
  const wearable = rows.filter((r) => WEARABLE_SOURCES.has(r.source));
  if (wearable.length > 0) return mergeMaxAll(wearable);
  return mergeMaxAll(rows);
}

function mergeRestingHr(rows: HealthMetricRow[]): MergedMetricValue | null {
  if (rows.length === 0) return null;
  const bySource = pickBySource(rows);
  const wearable = Object.entries(bySource).filter(([s]) => WEARABLE_SOURCES.has(s));
  const pool = wearable.length > 0 ? wearable : Object.entries(bySource);
  const best = pool.reduce((a, b) => (a[1] <= b[1] ? a : b));
  return {
    value: Math.round(best[1]),
    sources: pool.filter(([, v]) => v === best[1]).map(([s]) => s),
    strategy: wearable.length > 0 ? "max_wearable" : "max_all",
    bySource,
  };
}

export function mergeDailyHealthMetrics(
  rows: HealthMetricRow[],
  day: Date = startOfHealthDay(),
  timeZone?: string
): MergedDailyHealth {
  const dayRows = rowsForDay(rows, day, timeZone);
  const steps = mergeWearableFirst(dayRows.filter((r) => r.metricType === "steps"));
  const sleepMinutes = mergeSleep(dayRows.filter((r) => r.metricType === "sleep_minutes"));
  const activeMinutes = mergeMaxAll(dayRows.filter((r) => r.metricType === "active_minutes"));
  const restingHr = mergeRestingHr(dayRows.filter((r) => r.metricType === "resting_hr"));
  const connectedSources = [...new Set(dayRows.map((r) => r.source))];

  return {
    dayKey: dayKey(day, timeZone),
    steps,
    sleepMinutes,
    activeMinutes,
    restingHr,
    connectedSources,
  };
}

export function mergeRecentSleepMinutes(
  rows: HealthMetricRow[],
  withinDays = 7,
  timeZone?: string
): MergedMetricValue | null {
  const today = startOfHealthDay();
  for (let i = 0; i < withinDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const merged = mergeDailyHealthMetrics(rows, d, timeZone).sleepMinutes;
    if (merged) return merged;
  }
  return null;
}

export function formatSourceLabel(source: string): string {
  switch (source) {
    case "apple_health":
      return "Apple Health";
    case "health_connect":
      return "Health Connect";
    case "fitbit":
      return "Fitbit";
    case "kinzo":
      return "KINZO AI";
    case "habit":
      return "Habits";
    case "voice":
      return "Voice";
    default:
      return source;
  }
}

export function buildHealthCorrelationInsights(input: {
  merged: MergedDailyHealth;
  sleepHours: number | null;
  stepsToday: number | null;
  activeMinutes: number | null;
  restingHr: number | null;
  stepsTarget: number | null;
  workoutsCompletedThisWeek: number;
  weightChange7dKg: number | null;
  caloriesLogged: number | null;
  calorieTarget: number | null;
  calendarPacked: boolean;
  recoveryRecommended: boolean;
}): HealthCorrelationInsight[] {
  const insights: HealthCorrelationInsight[] = [];
  const sources = input.merged.connectedSources;

  if (sources.length >= 2) {
    insights.push({
      id: "multi-source",
      severity: "good",
      title: "Multiple health sources correlated",
      detail: `Vitalu merged ${sources.map(formatSourceLabel).join(", ")} — using the best trusted value per signal (wearables win over inferred).`,
    });
  } else if (sources.length === 1) {
    insights.push({
      id: "single-source",
      severity: "info",
      title: `Signal from ${formatSourceLabel(sources[0]!)}`,
      detail: "Connect another wearable or log manually to cross-check steps, sleep, and recovery.",
    });
  }

  if (
    input.stepsToday != null &&
    input.activeMinutes != null &&
    input.activeMinutes >= 20 &&
    input.stepsToday < (input.stepsTarget ?? 8000) * 0.5
  ) {
    insights.push({
      id: "active-not-steps",
      severity: "info",
      title: "Exercise time without high step count",
      detail: `${Math.round(input.activeMinutes)} active minutes logged — movement may be gym, cycling, or watch exercise sessions rather than walking.`,
    });
  }

  if (input.workoutsCompletedThisWeek > 0 && input.stepsToday != null && input.stepsToday < 3000) {
    insights.push({
      id: "workout-low-steps",
      severity: "info",
      title: "Workouts logged, steps still low",
      detail: "Structured workouts count toward movement even when step count is low — sync your watch if steps should be higher.",
    });
  }

  if (input.recoveryRecommended && input.calendarPacked) {
    insights.push({
      id: "sleep-calendar",
      severity: "watch",
      title: "Short sleep + packed calendar",
      detail: "Recovery is flagged from sleep data while today's calendar is heavy — Vitalu recommends lighter movement.",
    });
  }

  if (
    input.restingHr != null &&
    input.restingHr >= 78 &&
    input.sleepHours != null &&
    input.sleepHours < 6.5
  ) {
    insights.push({
      id: "hr-sleep",
      severity: "watch",
      title: "Elevated resting heart rate with short sleep",
      detail: `Resting HR ~${Math.round(input.restingHr)} bpm with ${input.sleepHours.toFixed(1)}h sleep — wellness context only, not medical advice.`,
    });
  }

  if (
    input.weightChange7dKg != null &&
    input.weightChange7dKg > 0.4 &&
    input.stepsToday != null &&
    input.stepsTarget != null &&
    input.stepsToday < input.stepsTarget * 0.6
  ) {
    insights.push({
      id: "weight-steps",
      severity: "info",
      title: "Weight up while movement is down",
      detail: "7-day weight trend is rising while today's steps are below target — pattern correlation, not a diagnosis.",
    });
  }

  if (
    input.caloriesLogged != null &&
    input.calorieTarget != null &&
    input.activeMinutes != null &&
    input.activeMinutes >= 30 &&
    input.caloriesLogged < input.calorieTarget * 0.7
  ) {
    insights.push({
      id: "fuel-activity",
      severity: "info",
      title: "High activity, light nutrition log",
      detail: "Active minutes are strong but meals logged are low — log food so nutrition and movement score together.",
    });
  }

  if (
    input.stepsToday != null &&
    input.stepsTarget != null &&
    input.stepsToday >= input.stepsTarget
  ) {
    insights.push({
      id: "steps-hit",
      severity: "good",
      title: "Step target reached",
      detail: `${Math.round(input.stepsToday).toLocaleString()} steps correlated from ${input.merged.steps?.sources.map(formatSourceLabel).join(" + ") ?? "your sources"}.`,
    });
  }

  return insights.slice(0, 6);
}

export async function fetchHealthMetricsForMerge(
  userId: string,
  since: Date
): Promise<HealthMetricRow[]> {
  const rows = await prisma.healthMetric.findMany({
    where: { userId, periodStart: { gte: since } },
    orderBy: { periodStart: "desc" },
  });
  return rows.map((r) => ({
    source: r.source,
    metricType: r.metricType,
    value: r.value,
    unit: r.unit,
    periodStart: r.periodStart,
    externalId: r.externalId,
    createdAt: r.createdAt,
  }));
}

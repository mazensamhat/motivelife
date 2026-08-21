/**
 * Health engine data-quality smokes.
 * Run: npx tsx apps/web/src/lib/vitalu/health-engine.smoke.ts
 */
import assert from "node:assert/strict";
import { civilDayKey, startOfCivilDay } from "../health-civil-day";
import {
  mergeDailyHealthMetrics,
  mergeLastNightSleepMinutes,
  mergeRecentSleepMinutes,
  type HealthMetricRow,
} from "../health-correlation";
import { buildVitaluScore } from "./vital-score";

// Civil day ≠ UTC ISO date near local midnight edges
{
  const localMidnight = startOfCivilDay(new Date(2026, 7, 21, 0, 30, 0)); // Aug 21 local
  assert.equal(civilDayKey(localMidnight), "2026-08-21");
  // A Date that is still Aug 20 in UTC for Americas evening — civil key must stay local.
  const evening = new Date(2026, 7, 20, 22, 0, 0);
  assert.equal(civilDayKey(evening), "2026-08-20");
}

const today = startOfCivilDay();
const todayKey = civilDayKey(today);
const y = new Date(today);
y.setDate(y.getDate() - 1);
const yKey = civilDayKey(y);
const old = new Date(today);
old.setDate(old.getDate() - 5);

const rows: HealthMetricRow[] = [
  {
    source: "health_connect",
    metricType: "steps",
    value: 446,
    unit: "steps",
    periodStart: today,
  },
  {
    source: "fitbit",
    metricType: "resting_hr",
    value: 58,
    unit: "bpm",
    periodStart: today,
  },
  // Poisonous ambulatory HR must not win as resting_hr
  {
    source: "health_connect",
    metricType: "heart_rate",
    value: 92,
    unit: "bpm",
    periodStart: today,
  },
  {
    source: "apple_health",
    metricType: "sleep_minutes",
    value: 498, // 8.3h
    unit: "minutes",
    periodStart: today,
  },
  {
    source: "apple_health",
    metricType: "sleeping_body_temp",
    value: 36.45,
    unit: "celsius",
    periodStart: today,
  },
  // Stale sleep 5 days ago — must not become "last night"
  {
    source: "fitbit",
    metricType: "sleep_minutes",
    value: 360,
    unit: "minutes",
    periodStart: old,
  },
];

const merged = mergeDailyHealthMetrics(rows, today);
assert.equal(merged.dayKey, todayKey);
assert.equal(merged.steps?.value, 446);
assert.equal(merged.restingHr?.value, 58);
assert.equal(merged.heartRate?.value, 92);
assert.ok(merged.sleepMinutes && merged.sleepMinutes.value === 498);
assert.ok(merged.sleepingBodyTempC && Math.abs(merged.sleepingBodyTempC.value - 36.45) < 0.01);

const lastNight = mergeLastNightSleepMinutes(rows);
assert.equal(lastNight.merged?.value, 498);
assert.equal(lastNight.asOfDayKey, todayKey);
assert.equal(lastNight.stale, false);

const noTodaySleep: HealthMetricRow[] = [
  {
    source: "fitbit",
    metricType: "sleep_minutes",
    value: 420,
    unit: "minutes",
    periodStart: y,
  },
  {
    source: "fitbit",
    metricType: "sleep_minutes",
    value: 300,
    unit: "minutes",
    periodStart: old,
  },
];
const yOnly = mergeLastNightSleepMinutes(noTodaySleep);
assert.equal(yOnly.merged?.value, 420, "yesterday sleep is last night");
assert.equal(yOnly.asOfDayKey, yKey);

const onlyOld = mergeLastNightSleepMinutes([
  {
    source: "fitbit",
    metricType: "sleep_minutes",
    value: 300,
    unit: "minutes",
    periodStart: old,
  },
]);
assert.equal(onlyOld.merged, null, "5-day-old sleep must not fill last night");

// Deprecated helper may still find older sleep — document the difference
const deprecated = mergeRecentSleepMinutes(
  [
    {
      source: "fitbit",
      metricType: "sleep_minutes",
      value: 300,
      unit: "minutes",
      periodStart: old,
    },
  ],
  7
);
assert.ok(deprecated && deprecated.value === 300);

const score = buildVitaluScore({
  caloriesConsumed: 1800,
  calorieTarget: 2200,
  proteinConsumedG: 120,
  proteinTargetG: 150,
  stepsToday: 446,
  stepsTarget: 8000,
  activeMinutesToday: null,
  workoutsCompletedThisWeek: 1,
  workoutsPerWeek: 3,
  sleepHoursLastNight: 8.3,
  restingHr: 58,
  sleepingBodyTempC: 36.45,
  sleepingBodyTempBaselineC: 36.4,
  daysWithSignalLast7: 6,
  priorTotal: 48,
});
assert.ok(score.total != null && score.total > 40);
assert.equal(score.trend, "up");
assert.ok(!score.missing.includes("Recovery"));

console.log("vitalu health-engine smoke: ok", {
  day: todayKey,
  vital: score.total,
  trend: score.trend,
  recovery: score.components.find((c) => c.key === "recovery")?.score,
});

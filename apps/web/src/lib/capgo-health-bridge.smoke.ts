/**
 * Capgo Health Connect metric mapping smoke (no native device required).
 */
import assert from "node:assert/strict";
import { metricsFromCapgoSamples, civilDayKeyFromIso } from "./capacitor-health-bridge";

const today = civilDayKeyFromIso(new Date().toISOString());
const yesterdayDate = new Date();
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
yesterdayDate.setHours(12, 0, 0, 0);
const yesterday = civilDayKeyFromIso(yesterdayDate.toISOString());

const startDate = new Date();
startDate.setHours(0, 0, 0, 0);
startDate.setDate(startDate.getDate() - 1);
const endDate = new Date().toISOString();

const metrics = metricsFromCapgoSamples({
  startDate: startDate.toISOString(),
  endDate,
  samplesByType: {
    steps: [
      { dataType: "steps", value: 4000, startDate: `${yesterday}T10:00:00.000Z` },
      { dataType: "steps", value: 6500, startDate: new Date().toISOString() },
    ],
    restingHeartRate: [
      { dataType: "restingHeartRate", value: 58, startDate: `${yesterday}T05:00:00.000Z` },
      { dataType: "restingHeartRate", value: 56, startDate: new Date().toISOString() },
    ],
    heartRate: [{ dataType: "heartRate", value: 72, startDate: new Date().toISOString() }],
    sleep: [
      {
        dataType: "sleep",
        value: 420,
        startDate: `${yesterday}T23:00:00.000Z`,
        endDate: `${today}T06:00:00.000Z`,
        sleepState: "asleep",
      },
      {
        dataType: "sleep",
        value: 40,
        startDate: `${yesterday}T22:00:00.000Z`,
        endDate: `${yesterday}T22:40:00.000Z`,
        sleepState: "awake",
      },
    ],
    calories: [{ dataType: "calories", value: 280, startDate: new Date().toISOString() }],
  },
  workouts: [
    {
      duration: 1800,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
    },
  ],
});

const byType = Object.fromEntries(metrics.map((m) => [m.metricType, m]));

assert.equal(byType.steps?.value, 6500, "today steps only");
assert.equal(byType.steps?.externalId, `steps-${today}`);
assert.equal(byType.resting_hr?.value, 56, "prefer today's RHR");
assert.ok((byType.sleep_minutes?.value ?? 0) >= 400, "asleep minutes counted");
assert.equal(byType.active_minutes?.value, 30, "workout duration → active minutes");
assert.equal(byType.heart_rate?.value, 72);

// Calories fallback when no workouts
const calOnly = metricsFromCapgoSamples({
  startDate: startDate.toISOString(),
  endDate,
  samplesByType: {
    calories: [{ dataType: "calories", value: 140, startDate: new Date().toISOString() }],
  },
  workouts: [],
});
assert.equal(calOnly.find((m) => m.metricType === "active_minutes")?.value, 20, "kcal/7 estimate");

console.log("capgo-health-bridge smoke: ok", {
  today,
  types: metrics.map((m) => `${m.metricType}=${m.value}`),
});

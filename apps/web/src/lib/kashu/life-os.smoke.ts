/**
 * Smoke: predicted vs actual accuracy + goal monthly parse + extra calendar spend.
 * Run: npx tsx apps/web/src/lib/kashu/life-os.smoke.ts
 */
import { accuracyFromSnapshots, applyObservation, blendConfidence, emptyLearning } from "./learning";
import { parseGoalMonthlyNeed } from "./goal-cost";
import { buildKashuForecast, type KashuProfileRow } from "./forecast";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const profile: KashuProfileRow = {
  liquidBalance: 3000,
  safetyFloor: 400,
  emergencyReserve: 2000,
  payFrequency: "BIWEEKLY",
  nextPayday: new Date("2026-08-28T12:00:00Z"),
  paydayAnchorDay: null,
  lifestyleBurnDaily: 20,
  monthlyTakeHome: 5000,
  incomeKind: "FIXED",
};

let state = emptyLearning();
state = {
  ...state,
  lastForecast: {
    asOf: "2026-08-17",
    projectedLow: 1800,
    lifestyleBurnDaily: 20,
    days: [{ date: "2026-08-17", endingBalance: 2500 }],
  },
};
state = applyObservation(state, 2200, "balance", new Date("2026-08-17T18:00:00Z"));
state = applyObservation(state, 2100, "balance", new Date("2026-08-17T19:00:00Z"));
assert(state.snapshots.length === 2, "two snapshots");
assert(accuracyFromSnapshots(state.snapshots) != null, "accuracy defined after 2 obs");
assert(blendConfidence(0.8, 0.6) < 0.8 && blendConfidence(0.8, 0.6) > 0.6, "blend between");

assert(parseGoalMonthlyNeed({ title: "Vacation $300/mo" }) === 300, "parse /mo");
assert(parseGoalMonthlyNeed({ title: "Italy", monthlyContribution: 250 }) === 250, "explicit monthly");
assert(
  (parseGoalMonthlyNeed({
    title: "Emergency fund",
    targetAmount: 3600,
    progress: 0,
    targetDate: new Date("2027-08-17"),
  }) ?? 0) >= 250,
  "total amortized"
);

const withTravel = buildKashuForecast(profile, [], {
  asOf: new Date("2026-08-17T12:00:00Z"),
  extraDailyBurn: 5,
  extraSpendByDate: { "2026-08-20": { title: "Conference", amount: 180 } },
});
const baseline = buildKashuForecast(profile, [], { asOf: new Date("2026-08-17T12:00:00Z") });
assert(withTravel.projectedLow < baseline.projectedLow, "life OS extras lower the projected low");
assert(
  withTravel.radar.some((e) => e.title === "Conference"),
  "calendar spend on radar"
);

console.log("kashu life-os smoke: ok");

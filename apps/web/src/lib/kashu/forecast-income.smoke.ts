/**
 * Smoke checks for Kashu Phase 3 income helpers.
 * Run: pnpm exec tsx apps/web/src/lib/kashu/forecast-income.smoke.ts
 * (or node with a TS loader when available)
 */
import {
  advancePaydayDate,
  buildKashuForecast,
  normalizeIncomeKind,
  resolveMonthlyIncome,
  type KashuProfileRow,
} from "./forecast";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const base: KashuProfileRow = {
  liquidBalance: 4000,
  safetyFloor: 500,
  emergencyReserve: 3000,
  payFrequency: "BIWEEKLY",
  nextPayday: new Date("2026-08-20T12:00:00Z"),
  paydayAnchorDay: null,
  lifestyleBurnDaily: 40,
  monthlyTakeHome: 7000,
  incomeKind: "VARIABLE",
  incomeConservative: 5000,
  incomeHigh: 9000,
};

assert(normalizeIncomeKind("variable") === "VARIABLE", "kind normalize");
assert(resolveMonthlyIncome(base, "conservative") === 5000, "conservative band");
assert(resolveMonthlyIncome(base, "expected") === 7000, "expected band");
assert(resolveMonthlyIncome(base, "high") === 9000, "high band");

const cons = buildKashuForecast(base, [], { incomeScenario: "conservative", asOf: new Date("2026-08-17") });
const high = buildKashuForecast(base, [], { incomeScenario: "high", asOf: new Date("2026-08-17") });
assert(cons.incomeScenario === "conservative", "scenario tag");
assert(high.safeToSpend >= cons.safeToSpend || high.projectedLow >= cons.projectedLow, "high >= cons outlook");
assert(cons.forecastConfidence > 0, "confidence");
assert(cons.emergencyInsight != null, "emergency insight");

const irregular = buildKashuForecast(
  { ...base, payFrequency: "IRREGULAR", incomeKind: "FIXED" },
  [],
  { asOf: new Date("2026-08-17"), horizonDays: 30 }
);
const paydayEvents = irregular.radar.filter((e) => e.kind === "payday");
assert(paydayEvents.length <= 1, "irregular schedules at most one payday in 30d");

const next = advancePaydayDate(new Date("2026-08-17"), "BIWEEKLY", null, new Date("2026-08-17"));
assert(next.toISOString().slice(0, 10) === "2026-08-31", `advance biweekly got ${next.toISOString()}`);

console.log("kashu forecast-income smoke: ok");

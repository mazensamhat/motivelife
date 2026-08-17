/**
 * Smoke checks for Kashu Phase 4 Can-I-Afford / What-If.
 * Run: npx tsx apps/web/src/lib/kashu/forecast-whatif.smoke.ts
 */
import { buildKashuForecast, runKashuWhatIf, type KashuMoneyRow, type KashuProfileRow } from "./forecast";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const profile: KashuProfileRow = {
  liquidBalance: 3500,
  safetyFloor: 400,
  emergencyReserve: 2000,
  payFrequency: "BIWEEKLY",
  nextPayday: new Date("2026-08-28T12:00:00Z"),
  paydayAnchorDay: null,
  lifestyleBurnDaily: 25,
  monthlyTakeHome: 6000,
  incomeKind: "FIXED",
};

const bills: KashuMoneyRow[] = [
  {
    id: "rent",
    type: "HOUSING",
    title: "Rent",
    currentAmount: 1600,
    dueDay: 1,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
];

const baseline = buildKashuForecast(profile, bills, { asOf: new Date("2026-08-17") });
assert(baseline.safeToSpend > 0, "baseline STS");

const affordable = runKashuWhatIf(profile, bills, {
  spendToday: Math.min(200, Math.max(50, Math.floor(baseline.safeToSpend * 0.2))),
});
assert(affordable.verdict === "yes" || affordable.verdict === "caution", `small spend verdict ${affordable.verdict}`);
assert(affordable.canAfford === true, "small spend canAfford");
assert(typeof affordable.deltaProjectedLow === "number", "delta low");

const tooMuch = runKashuWhatIf(profile, bills, {
  spendToday: baseline.safeToSpend + 2500,
});
assert(tooMuch.verdict === "no", "overspend is no");
assert(tooMuch.canAfford === false, "overspend not affordable");

const newBill = runKashuWhatIf(profile, bills, {
  newMonthlyBill: { title: "Car", amount: 500, dueDay: 20 },
});
assert(newBill.scenario.safeToSpend <= baseline.safeToSpend, "new bill lowers or holds STS");
assert(["yes", "caution", "no"].includes(newBill.verdict), "verdict enum");

const cut = runKashuWhatIf(profile, bills, { cutLifestyleDaily: 10 });
assert(cut.scenario.projectedLow >= baseline.projectedLow, "cutting burn helps projected low");

console.log("kashu forecast-whatif smoke: ok");

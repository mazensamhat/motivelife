/**
 * Smoke checks for Kashu bill-timing optimizer.
 * Run: npx tsx apps/web/src/lib/kashu/forecast-timing.smoke.ts
 */
import { buildKashuForecast, type KashuMoneyRow, type KashuProfileRow } from "./forecast";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const profile: KashuProfileRow = {
  liquidBalance: 900,
  safetyFloor: 400,
  emergencyReserve: 0,
  payFrequency: "MONTHLY",
  nextPayday: new Date("2026-06-15T12:00:00"),
  paydayAnchorDay: 15,
  lifestyleBurnDaily: 30,
  monthlyTakeHome: 4500,
  incomeKind: "FIXED",
};

const classic: KashuMoneyRow[] = [
  {
    id: "a",
    type: "BILL",
    title: "Insurance",
    currentAmount: 715,
    dueDay: 5,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "b",
    type: "BILL",
    title: "Utilities",
    currentAmount: 280,
    dueDay: 3,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "NECESSARY",
    confidence: 1,
  },
];

const classicForecast = buildKashuForecast(profile, classic, {
  asOf: new Date("2026-06-01"),
  horizonDays: 45,
});
assert(classicForecast.timingScenarios.length >= 1, "classic timing finds moves");
assert(
  classicForecast.timingScenarios.some((s) => s.moveToDay >= 15),
  "prefers post-payday due day"
);
assert(
  classicForecast.timingScenarios[0]!.projectedLow > classicForecast.projectedLow,
  "best move raises projected low"
);

// nextDueDate-only monthly bills must still schedule + optimize
const inferred: KashuMoneyRow[] = [
  {
    id: "ins",
    type: "BILL",
    title: "Aviva",
    currentAmount: 800,
    dueDay: null,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: new Date("2026-06-02T12:00:00"),
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "car",
    type: "DEBT",
    title: "Car payment",
    currentAmount: 450,
    dueDay: 4,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
];

const inferredForecast = buildKashuForecast(
  { ...profile, liquidBalance: 1200, nextPayday: new Date("2026-06-05T12:00:00") },
  inferred,
  { asOf: new Date("2026-05-28"), horizonDays: 45 }
);
assert(
  inferredForecast.radar.some((r) => r.title === "Aviva"),
  "infers monthly due from nextDueDate"
);
assert(
  inferredForecast.radar.some((r) => r.title === "Car payment"),
  "includes DEBT in cash calendar"
);
assert(inferredForecast.timingScenarios.length >= 1, "timing works without explicit dueDay");

const housingOnly: KashuMoneyRow[] = [
  {
    id: "rent",
    type: "HOUSING",
    title: "Rent",
    currentAmount: 2000,
    dueDay: 1,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
];
const housingForecast = buildKashuForecast(
  { ...profile, liquidBalance: 500, nextPayday: new Date("2026-06-15T12:00:00") },
  housingOnly,
  { asOf: new Date("2026-06-01"), horizonDays: 45 }
);
assert(housingForecast.timingScenarios.length >= 1, "housing is eligible for timing guidance");

console.log("kashu forecast-timing smoke: ok");

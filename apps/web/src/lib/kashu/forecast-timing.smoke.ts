/**
 * Smoke checks for Kashu bill-timing optimizer + multi-bill spread.
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
  {
    id: "c",
    type: "SUBSCRIPTION",
    title: "Internet",
    currentAmount: 90,
    dueDay: 2,
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
  classicForecast.timingScenarios.some((s) => s.moveToDay >= 15) ||
    classicForecast.timingScenarios.some((s) => s.moves?.some((m) => m.moveToDay >= 15)),
  "prefers post-payday due day"
);
assert(
  classicForecast.timingScenarios[0]!.projectedLow > classicForecast.projectedLow,
  "best move raises projected low"
);

const spread = classicForecast.timingScenarios.find((s) => s.moves && s.moves.length >= 2);
assert(spread != null, "multi-bill spread plan is produced");
assert(
  new Set(spread!.moves!.map((m) => m.moveToDay)).size >= 2,
  "spread plan uses distinct due days when possible"
);

// Negative starting balance must be preserved (overdraft)
const neg = buildKashuForecast(
  { ...profile, liquidBalance: -150.25 },
  classic,
  { asOf: new Date("2026-06-01"), horizonDays: 30 }
);
assert(neg.liquidBalance === -150.25, `negative balance preserved got ${neg.liquidBalance}`);

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

// Monthly payday cadence should stay on the same DOM (not drift by +30 days)
const monthlyPay = buildKashuForecast(
  {
    ...profile,
    payFrequency: "MONTHLY",
    nextPayday: new Date("2026-05-31T12:00:00"),
    paydayAnchorDay: null,
    liquidBalance: 2000,
  },
  [],
  { asOf: new Date("2026-05-28"), horizonDays: 70 }
);
const payDays = monthlyPay.radar.filter((r) => r.kind === "payday").map((r) => r.date);
assert(
  payDays.some((d) => d.endsWith("-31")) && payDays.some((d) => d.endsWith("-30")),
  `monthly end-of-month payday preserved got ${payDays.join(",")}`
);

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

// Dual track: best financial (often mortgage) + least disruptive (flexible only).
{
  const dual = buildKashuForecast(
    {
      liquidBalance: 4200,
      safetyFloor: 0,
      emergencyReserve: 0,
      payFrequency: "BIWEEKLY",
      nextPayday: new Date("2026-09-04T12:00:00"),
      paydayAnchorDay: 4,
      lifestyleBurnDaily: 0,
      monthlyTakeHome: 12000,
      typicalPaycheck: 5500,
      paycheckLow: 3700,
      paycheckHigh: 7700,
      incomeKind: "VARIABLE",
    },
    [
      {
        id: "mortgage",
        type: "HOUSING",
        title: "RBC Mortgage",
        currentAmount: 3888.61,
        dueDay: 3,
        autoPay: true,
        frequency: "MONTHLY",
        intervalDays: null,
        nextDueDate: null,
        priority: "MANDATORY",
        confidence: 1,
      },
      {
        id: "aviva",
        type: "BILL",
        title: "Aviva Home/Auto",
        currentAmount: 1152.14,
        dueDay: 6,
        autoPay: true,
        frequency: "MONTHLY",
        intervalDays: null,
        nextDueDate: null,
        priority: "MANDATORY",
        confidence: 1,
      },
      {
        id: "bell",
        type: "BILL",
        title: "Bell Canada",
        currentAmount: 690.17,
        dueDay: 10,
        autoPay: true,
        frequency: "MONTHLY",
        intervalDays: null,
        nextDueDate: null,
        priority: "NECESSARY",
        confidence: 1,
      },
      {
        id: "enbridge",
        type: "BILL",
        title: "Enbridge Gas",
        currentAmount: 847,
        dueDay: 26,
        autoPay: true,
        frequency: "MONTHLY",
        intervalDays: null,
        nextDueDate: null,
        priority: "MANDATORY",
        confidence: 1,
      },
    ],
    {
      asOf: new Date("2026-08-21T12:00:00"),
      horizonDays: 60,
      liquidAsOf: "current",
      payrollDeposits: [
        { date: "2026-09-04", amount: 3700 },
        { date: "2026-09-18", amount: 7700 },
        { date: "2026-10-02", amount: 3700 },
      ],
    }
  );
  const best = dual.timingScenarios.find((s) => s.track === "best_financial");
  const least = dual.timingScenarios.find((s) => s.track === "least_disruptive");
  assert(best, "best financial track must appear when tips exist");
  assert(
    best && /mortgage/i.test(best.billTitle),
    `best financial should prefer mortgage when lift dominates got ${best?.billTitle}`
  );
  assert(best?.recommended, "best financial is the recommended track");
  assert(
    /Providers may not allow/i.test(best!.note),
    "hard best-financial tip keeps provider caveat"
  );
  if (least) {
    assert(
      !(least.moves ?? []).some((m) => /mortgage/i.test(m.billTitle)) &&
        !/mortgage/i.test(least.billTitle),
      "least disruptive must leave mortgage alone"
    );
    assert(
      least.projectedLow > dual.projectedLow,
      "least disruptive must still raise the trough"
    );
  }
}

console.log("kashu forecast-timing smoke: ok");

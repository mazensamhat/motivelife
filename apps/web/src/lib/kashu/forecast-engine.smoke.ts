/**
 * Smoke checks for smarter prediction + Timing honesty.
 * Run: npx tsx apps/web/src/lib/kashu/forecast-engine.smoke.ts
 */
import {
  buildKashuForecast,
  obligationDatesInRange,
  type KashuMoneyRow,
  type KashuProfileRow,
} from "./forecast";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const asOf = new Date("2026-08-01T12:00:00");

// ── Annual property tax: override moves day, keeps month ─────────────────
const propertyTax: KashuMoneyRow = {
  id: "tax",
  type: "BILL",
  title: "Property tax",
  currentAmount: 2400,
  dueDay: 5,
  autoPay: false,
  frequency: "ANNUAL",
  intervalDays: null,
  nextDueDate: new Date("2026-08-05T12:00:00"),
  priority: "MANDATORY",
  confidence: 1,
};

const natural = obligationDatesInRange(
  propertyTax,
  asOf,
  new Date("2026-09-15T12:00:00")
);
assert(
  natural.length === 1 && natural[0]!.getDate() === 5 && natural[0]!.getMonth() === 7,
  `annual natural Aug 5 got ${natural.map((d) => d.toISOString()).join(",")}`
);

const moved = obligationDatesInRange(
  propertyTax,
  asOf,
  new Date("2026-09-15T12:00:00"),
  22
);
assert(
  moved.length === 1 && moved[0]!.getDate() === 22 && moved[0]!.getMonth() === 7,
  `annual override keeps August, moves to 22 got ${moved.map((d) => d.toISOString()).join(",")}`
);

// ── DEBT reserved until next payday ──────────────────────────────────────
const biweeklyProfile: KashuProfileRow = {
  liquidBalance: 0,
  safetyFloor: 200,
  emergencyReserve: 0,
  payFrequency: "BIWEEKLY",
  nextPayday: new Date("2026-08-07T12:00:00"),
  paydayAnchorDay: 7,
  lifestyleBurnDaily: 40,
  monthlyTakeHome: 5200,
  typicalPaycheck: 2400,
  incomeKind: "FIXED",
};

const coxBills: KashuMoneyRow[] = [
  {
    id: "mortgage",
    type: "HOUSING",
    title: "Mortgage",
    currentAmount: 1800,
    dueDay: 1,
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
    title: "Aviva",
    currentAmount: 715,
    dueDay: 3,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "tax",
    type: "BILL",
    title: "Property tax",
    currentAmount: 900,
    dueDay: 5,
    autoPay: false,
    frequency: "ANNUAL",
    intervalDays: null,
    nextDueDate: new Date("2026-08-05T12:00:00"),
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "car",
    type: "DEBT",
    title: "Car loan",
    currentAmount: 420,
    dueDay: 4,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "gym",
    type: "SUBSCRIPTION",
    title: "Gym",
    currentAmount: 55,
    dueDay: 2,
    autoPay: true,
    frequency: "BIWEEKLY",
    intervalDays: 14,
    nextDueDate: new Date("2026-08-02T12:00:00"),
    priority: "NECESSARY",
    confidence: 1,
  },
];

const shortfall = buildKashuForecast(biweeklyProfile, coxBills, {
  asOf,
  horizonDays: 45,
});

assert(shortfall.projectedLow <= shortfall.safetyFloor + 25, "shortfall case is underfunded");
assert(shortfall.reservedObligations >= 420, "DEBT is included in reserved obligations");
assert(
  shortfall.radar.some((r) => r.title === "Gym" && r.kind === "obligation"),
  "BIWEEKLY bills appear on the cash calendar"
);
assert(
  shortfall.forecastConfidence < 0.85,
  `stress confidence should drop under shortfall got ${shortfall.forecastConfidence}`
);

// recommended:true only when trough actually lifts (or collisions clear with no worse trough)
for (const s of shortfall.timingScenarios) {
  if (!s.recommended) continue;
  const lift = s.projectedLow - shortfall.projectedLow;
  assert(
    lift > 0.5 || s.note.toLowerCase().includes("collision"),
    `recommended scenario must prove lift or collision clear: ${s.billTitle} lift=${lift} note=${s.note}`
  );
}

// Zero-lift coach tips must not claim recommended success
const zeroLiftTips = shortfall.timingScenarios.filter(
  (s) => s.recommended && s.projectedLow <= shortfall.projectedLow + 0.5
);
assert(
  zeroLiftTips.every((s) => /collision/i.test(s.note)),
  "zero-lift recommended only allowed when clearing collisions"
);

// Annual move should change radar date in what-if style sim
const taxMoved = buildKashuForecast(biweeklyProfile, coxBills, {
  asOf,
  horizonDays: 45,
  skipTiming: true,
  moveBills: { tax: 22 },
});
const taxEvents = taxMoved.radar.filter((r) => r.title === "Property tax");
assert(
  taxEvents.some((e) => e.date.endsWith("-22")),
  `property tax move lands on the 22nd got ${taxEvents.map((e) => e.date).join(",")}`
);
assert(
  !taxEvents.some((e) => e.date.endsWith("-05")),
  "property tax should leave the 5th after override"
);

// Lifestyle burn below floor surfaces as a collision signal
assert(
  shortfall.collisions.some((c) => /lifestyle|Aviva|Mortgage|Property|Gym|Car/i.test(c.title)),
  "shortfall produces collision signal"
);

// Message should not pretend Timing invents cash when trough is broken
assert(
  /Buffers|Timing|short|negative|floor/i.test(shortfall.message),
  `honest shortfall message got: ${shortfall.message}`
);

// Payroll overlay changes deposit amount in the sim
const withPayroll = buildKashuForecast(
  { ...biweeklyProfile, liquidBalance: 800 },
  coxBills.filter((b) => b.id === "aviva" || b.id === "gym"),
  {
    asOf,
    horizonDays: 30,
    skipTiming: true,
    payrollDeposits: [
      { date: "2026-08-07", amount: 3100 },
      { date: "2026-08-21", amount: 3100 },
    ],
  }
);
const aug7 = withPayroll.radar.find((r) => r.date === "2026-08-07" && r.kind === "payday");
assert(aug7?.amount === 3100, `payroll overlay amount got ${aug7?.amount}`);

console.log("kashu forecast-engine smoke: ok");

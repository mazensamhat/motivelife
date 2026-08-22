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
import { buildRollForwardEvents, chooseLiquidBalance, rollBalanceToAsOf } from "./liquid";

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

// ── Fake-lift regression: Timing must not delete bills from the window ───
const crowded: KashuMoneyRow[] = [
  {
    id: "m",
    type: "HOUSING",
    title: "RBC Mortgage",
    currentAmount: 1800,
    dueDay: 3,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "a",
    type: "BILL",
    title: "Aviva Home/Auto",
    currentAmount: 715,
    dueDay: 6,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "tax2",
    type: "BILL",
    title: "Windsor Property Tax",
    currentAmount: 900,
    dueDay: 28,
    autoPay: false,
    frequency: "ANNUAL",
    intervalDays: null,
    nextDueDate: new Date("2026-08-28T12:00:00"),
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "wife",
    type: "LIVING_EXPENSE",
    title: "My Wife",
    currentAmount: 900,
    dueDay: 21,
    autoPay: false,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "DISCRETIONARY",
    confidence: 1,
  },
  {
    id: "n",
    type: "SUBSCRIPTION",
    title: "Netflix",
    currentAmount: 23,
    dueDay: 13,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "LIFESTYLE",
    confidence: 1,
  },
];

const midMonth = buildKashuForecast(biweeklyProfile, crowded, {
  asOf: new Date("2026-08-21T12:00:00"),
  horizonDays: 45,
});
assert(
  midMonth.timingScenarios.every((s) => !/wife/i.test(s.billTitle) && !(s.moves ?? []).some((m) => /wife/i.test(m.billTitle))),
  "My Wife / transfers must never appear in Timing"
);

const baseObl = midMonth.radar
  .filter((r) => r.kind === "obligation" && r.date >= midMonth.asOf)
  .reduce((s, r) => s + r.amount, 0);

for (const s of midMonth.timingScenarios) {
  if (!s.recommended) continue;
  const moves = s.moves
    ? Object.fromEntries(s.moves.map((m) => [m.billId, m.moveToDay]))
    : { [s.billId]: s.moveToDay };
  const trial = buildKashuForecast(biweeklyProfile, crowded, {
    asOf: new Date("2026-08-21T12:00:00"),
    horizonDays: 45,
    skipTiming: true,
    moveBills: moves,
  });
  const trialObl = trial.radar
    .filter((r) => r.kind === "obligation" && r.date >= trial.asOf)
    .reduce((sum, r) => sum + r.amount, 0);
  assert(
    trialObl >= baseObl - 1,
    `recommended Timing must not delete obligation dollars (${s.billTitle}: base ${baseObl} trial ${trialObl})`
  );
  assert(
    s.projectedLow - midMonth.projectedLow < 4000,
    `suspiciously huge Timing lift blocked (${s.billTitle}: ${midMonth.projectedLow} → ${s.projectedLow})`
  );
}

// Annual override before today must keep the natural due (no vanish)
const taxKept = buildKashuForecast(biweeklyProfile, crowded, {
  asOf: new Date("2026-08-21T12:00:00"),
  horizonDays: 45,
  skipTiming: true,
  moveBills: { tax2: 2 },
});
assert(
  taxKept.radar.some((r) => r.title === "Windsor Property Tax" && r.date === "2026-08-28"),
  "annual override to a past day keeps natural date in-window"
);

// Lookback balances: past payday must affect day endings; asOf starts at liquid
const lookbackAsOf = new Date("2026-08-20T12:00:00");
const lookbackSim = buildKashuForecast(
  { ...biweeklyProfile, liquidBalance: 1200, lifestyleBurnDaily: 0, nextPayday: new Date("2026-08-21T12:00:00") },
  coxBills.filter((b) => b.id === "aviva"),
  {
    asOf: lookbackAsOf,
    horizonDays: 14,
    lookbackDays: 20,
    skipTiming: true,
    payrollDeposits: [
      { date: "2026-08-07", amount: 3700 },
      { date: "2026-08-21", amount: 3700 },
    ],
  }
);
const asOfDay = lookbackSim.days.find((d) => d.date === "2026-08-20");
assert(asOfDay != null, "asOf day present in days[]");
assert(
  asOfDay!.startingBalance === 1200,
  `asOf startingBalance must equal liquid got ${asOfDay!.startingBalance}`
);
const aug7Pay = lookbackSim.radar.find((r) => r.date === "2026-08-07" && r.kind === "payday");
assert(aug7Pay != null && aug7Pay.amount === 3700, "Aug 7 payday on radar");
assert(
  aug7Pay!.balanceAfter !== 0,
  "past payday must carry a real balanceAfter (not the old blank 0)"
);
const dayBefore = lookbackSim.days.find((d) => d.date === "2026-08-06");
const dayPay = lookbackSim.days.find((d) => d.date === "2026-08-07");
assert(dayBefore && dayPay, "lookback days around payday exist");
assert(
  dayPay!.endingBalance > dayBefore!.endingBalance,
  `payday must raise the road (${dayBefore!.endingBalance} → ${dayPay!.endingBalance})`
);
assert(
  lookbackSim.projectedLowDate == null || lookbackSim.projectedLowDate >= "2026-08-20",
  `projectedLow must stay on/after asOf got ${lookbackSim.projectedLowDate}`
);

// Mid-month: already-posted dues must not reappear as Timing "softens −$6k" tips
const midPaid = buildKashuForecast(
  {
    ...biweeklyProfile,
    liquidBalance: -955,
    lifestyleBurnDaily: 0,
    safetyFloor: 0,
    nextPayday: new Date("2026-08-21T12:00:00"),
    paydayAnchorDay: 21,
  },
  crowded,
  {
    asOf: new Date("2026-08-21T12:00:00"),
    horizonDays: 45,
    payrollDeposits: [
      { date: "2026-08-07", amount: 3698 },
      { date: "2026-08-21", amount: 7689 },
    ],
  }
);
assert(
  !midPaid.timingScenarios.some((s) => /mortgage|aviva/i.test(s.billTitle)),
  `past-due mortgage/aviva must not be Timing tips mid-month got ${midPaid.timingScenarios.map((s) => s.billTitle).join(",")}`
);
assert(
  midPaid.projectedLow > -2000,
  `mid-month with payday must not invent early-month −$6k trough got ${midPaid.projectedLow}`
);

// Unknown balance → no Timing theater
const noBalProfile: KashuProfileRow = { ...biweeklyProfile, liquidBalance: null };
const noBal = buildKashuForecast(noBalProfile, crowded, {
  asOf: new Date("2026-08-01T12:00:00"),
  horizonDays: 30,
});
assert(noBal.timingScenarios.length === 0, "null liquidBalance suppresses Timing tips");
assert(/Buffers/i.test(noBal.message), `null balance message should demand Buffers got ${noBal.message}`);

// Statement ledger overrides stale $0 / −$955 Buffers
assert(chooseLiquidBalance(null, 4517.32).source === "ledger", "null → ledger");
assert(chooseLiquidBalance(0, 4517.32).liquid === 4517.32, "stale zero → ledger");
assert(chooseLiquidBalance(-955, 4517.32).liquid === 4517.32, "stale OD → ledger");
assert(chooseLiquidBalance(2200, 4517.32).liquid === 2200, "explicit balance kept");
assert(chooseLiquidBalance(6984.61, 1498.54).liquid === 6984.61, "user-entered ~$7k kept");
assert(chooseLiquidBalance(6984.61, 1498.54).source === "profile", "user-entered ~$7k is profile");
assert(
  chooseLiquidBalance(14000, 1498.54).liquid === 1498.54,
  "inflated stale Buffers must yield to statement ledger"
);
assert(
  chooseLiquidBalance(14000, 1498.54).source === "ledger",
  "inflated stale Buffers source is ledger"
);
assert(
  chooseLiquidBalance(14000, 9000).liquid === 9000,
  "huge Buffers 1.5× above ledger must yield"
);

// Buffers "bank shows now" must pin TODAY — do not add asOf payday on top ($6984 → $14k bug)
{
  const pinned = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 6984.61,
      lifestyleBurnDaily: 0,
      nextPayday: new Date("2026-08-21T12:00:00"),
      paydayAnchorDay: 21,
      payFrequency: "BIWEEKLY",
      monthlyTakeHome: 12361,
      typicalPaycheck: 5500,
      paycheckLow: 3698.25,
      paycheckHigh: 7689.86,
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
    ],
    {
      asOf: new Date("2026-08-21T12:00:00"),
      horizonDays: 30,
      liquidAsOf: "current",
      payrollDeposits: [
        { date: "2026-08-21", amount: 7689.86 },
        { date: "2026-09-04", amount: 3698.25 },
      ],
    }
  );
  const today = pinned.days.find((d) => d.date === "2026-08-21");
  assert(today != null, "pinned forecast must include asOf day");
  assert(
    Math.abs(today!.endingBalance - 6984.61) < 1,
    `current liquidAsOf must pin TODAY to $6984.61 got ${today!.endingBalance}`
  );
  assert(
    today!.income >= 7600,
    `asOf payday must still appear as a label got income=${today!.income}`
  );
  assert(
    pinned.projectedLow <= 6984.61 + 1,
    `projectedLow must not jump above pinned liquid via asOf payday got ${pinned.projectedLow}`
  );
}

// HARD GUARANTEE: deposits alone schedule income even when profile paycheck fields are null
{
  const depositOnly = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 1498.54,
      typicalPaycheck: null,
      monthlyTakeHome: null,
      nextPayday: null,
      paydayAnchorDay: null,
      payFrequency: null,
      lifestyleBurnDaily: 0,
    },
    crowded,
    {
      asOf: new Date("2026-08-21T12:00:00"),
      horizonDays: 90,
      payrollDeposits: [
        { date: "2026-08-07", amount: 3698 },
        { date: "2026-08-21", amount: 7690 },
        { date: "2026-09-04", amount: 3698 },
        { date: "2026-09-18", amount: 7690 },
        { date: "2026-10-02", amount: 3698 },
        { date: "2026-10-16", amount: 7690 },
        { date: "2026-10-30", amount: 3698 },
        { date: "2026-11-13", amount: 7690 },
      ],
    }
  );
  const augIncomeDays = depositOnly.days.filter(
    (d) => d.date >= "2026-08-01" && d.date <= "2026-08-31" && d.income > 0
  );
  assert(
    augIncomeDays.length >= 2,
    `deposits must create August payday spikes got ${augIncomeDays.length}`
  );
  assert(
    depositOnly.projectedLow > -5000,
    `deposits must prevent −$26k Timing hole got ${depositOnly.projectedLow}`
  );
  // Chart shape: must have an upward jump (payday), not expenses-only staircase
  const augEnds = depositOnly.days
    .filter((d) => d.date >= "2026-08-01" && d.date <= "2026-08-31")
    .map((d) => d.endingBalance);
  let jump = false;
  for (let i = 1; i < augEnds.length; i++) {
    if (augEnds[i]! - augEnds[i - 1]! >= 400) jump = true;
  }
  assert(jump, "August ending balances must show at least one payday jump");
}

// Far-future profile nextPayday must not surface as "1336d"
{
  const far = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 1498.54,
      typicalPaycheck: 5000,
      monthlyTakeHome: 10000,
      nextPayday: new Date("2030-04-18T12:00:00"),
      payFrequency: "BIWEEKLY",
      lifestyleBurnDaily: 0,
    },
    crowded,
    {
      asOf: new Date("2026-08-21T12:00:00"),
      horizonDays: 45,
      payrollDeposits: [
        { date: "2026-08-07", amount: 3698 },
        { date: "2026-08-21", amount: 7690 },
        { date: "2026-09-04", amount: 3698 },
      ],
    }
  );
  assert(
    far.daysUntilPayday == null || far.daysUntilPayday <= 45,
    `daysUntilPayday must not be 1336 got ${far.daysUntilPayday}`
  );
  assert(
    !far.nextPayday || far.nextPayday.startsWith("2026-"),
    `nextPayday must be near-term got ${far.nextPayday}`
  );
}

// No-income config must not paint payday spikes; payroll overlay restores them.
// (Inflated liquid alone can stay green — the −$13k class bug is missing income.)
{
  const noPayProfile: KashuProfileRow = {
    ...biweeklyProfile,
    liquidBalance: 14000,
    typicalPaycheck: null,
    monthlyTakeHome: null,
    nextPayday: null,
    paydayAnchorDay: null,
    payFrequency: null,
    lifestyleBurnDaily: 0,
  };
  const broken = buildKashuForecast(noPayProfile, crowded, {
    asOf: new Date("2026-08-21T12:00:00"),
    horizonDays: 60,
  });
  assert(
    broken.radar.filter((e) => e.kind === "payday").length === 0,
    "null paycheck config must schedule zero paydays"
  );
  assert(
    broken.days.every((d) => d.income === 0),
    "expenses-only day path must have zero income (green staircase bug)"
  );

  const repaired = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 1498.54,
      typicalPaycheck: 5500,
      monthlyTakeHome: 11000,
      paycheckLow: 3698,
      paycheckHigh: 7690,
      nextPayday: new Date("2026-08-21T12:00:00"),
      paydayAnchorDay: 21,
      payFrequency: "BIWEEKLY",
      lifestyleBurnDaily: 0,
      incomeKind: "VARIABLE",
    },
    crowded,
    {
      asOf: new Date("2026-08-21T12:00:00"),
      horizonDays: 60,
      payrollDeposits: [
        { date: "2026-08-07", amount: 3698 },
        { date: "2026-08-21", amount: 7690 },
        { date: "2026-09-04", amount: 3698 },
        { date: "2026-09-18", amount: 7690 },
      ],
    }
  );
  const augPays = repaired.days.filter(
    (d) => d.date >= "2026-08-01" && d.date <= "2026-08-31" && d.income > 0
  );
  assert(augPays.length >= 2, `repaired August must show payday income days got ${augPays.length}`);
  assert(
    repaired.projectedLow > -2000,
    `repaired with Cox deposits must not invent −$13k got ${repaired.projectedLow}`
  );
}

// Same-day window credit + payroll must not double-count
{
  const events = buildRollForwardEvents({
    items: [],
    payroll: [{ date: "2026-08-07", amount: 3698 }],
    fromYmd: "2026-07-31",
    toYmd: "2026-08-21",
    windowTxs: [{ date: "2026-08-07", amount: 3698.25, direction: "credit" }],
  });
  const aug7Credits = events.filter((e) => e.date === "2026-08-07" && e.amount > 0);
  assert(
    aug7Credits.length === 1,
    `same-day Cox credit must appear once got ${JSON.stringify(aug7Credits)}`
  );
}

// Roll Jul 31 close → Aug 21 morning (excludes Aug 21 payday; includes Aug 7 pay + bills)
const rolled = rollBalanceToAsOf({
  opening: 4517.32,
  anchorYmd: "2026-07-31",
  asOfYmd: "2026-08-21",
  events: [
    { date: "2026-08-02", amount: -59 },
    { date: "2026-08-03", amount: -3888.61 },
    { date: "2026-08-06", amount: -1152.14 },
    { date: "2026-08-07", amount: 3698.25 },
    { date: "2026-08-07", amount: -900 },
    { date: "2026-08-10", amount: -690.17 },
    { date: "2026-08-13", amount: -27.11 },
    { date: "2026-08-21", amount: 7689.86 }, // must NOT apply (asOf morning)
  ],
});
assert(
  Math.abs(rolled - 1498.54) < 0.02,
  `roll to Aug21 morning expected ~1498.54 got ${rolled}`
);

// Window txs (Wife transfer) must enter the roll even though Timing excludes them
{
  const withWife = buildRollForwardEvents({
    items: crowded.filter((i) => !/wife/i.test(i.title)),
    payroll: [{ date: "2026-08-07", amount: 3698.25 }],
    fromYmd: "2026-07-31",
    toYmd: "2026-08-21",
    windowTxs: [{ date: "2026-08-07", amount: 900, direction: "debit" }],
  });
  assert(
    withWife.some((e) => e.date === "2026-08-07" && e.amount === -900),
    "Wife e-transfer debit must appear in roll-forward events"
  );
}

// Buffers $6,984.61 + Cox must never invent the production −$2,174 / Nov-12 Timing hole
// (that trough only appears with liquid ≈ $3,616 on a Nov-1 style path).
{
  const coxBills: KashuMoneyRow[] = [
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
  ];
  const withBuffers = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 6984.61,
      lifestyleBurnDaily: 0,
      nextPayday: new Date("2026-09-04T12:00:00"),
      paydayAnchorDay: 4,
      monthlyTakeHome: 12361,
      typicalPaycheck: 5500,
      paycheckLow: 3698.25,
      paycheckHigh: 7689.86,
      incomeKind: "VARIABLE",
    },
    coxBills,
    {
      asOf: new Date("2026-08-21T12:00:00"),
      horizonDays: 90,
      liquidAsOf: "current",
      payrollDeposits: [
        { date: "2026-08-21", amount: 7689.86 },
        { date: "2026-09-04", amount: 3698.25 },
        { date: "2026-09-18", amount: 7689.86 },
        { date: "2026-10-02", amount: 3698.25 },
        { date: "2026-10-16", amount: 7689.86 },
        { date: "2026-10-30", amount: 3698.25 },
        { date: "2026-11-13", amount: 7689.86 },
      ],
    }
  );
  assert(
    withBuffers.projectedLow > 0,
    `Buffers $6984.61 must stay solvent got ${withBuffers.projectedLow}`
  );
  assert(
    withBuffers.projectedLowDate !== "2026-11-12",
    `must not claim Nov12 trough with Buffers $6984 got ${withBuffers.projectedLowDate}`
  );
  assert(
    Math.abs(withBuffers.projectedLow + 2174) > 500,
    `must not reproduce production −$2174 with Buffers $6984 got ${withBuffers.projectedLow}`
  );
  // Control: liquid ≈ $3616 on Nov1 IS the −$2174 class (wrong live inputs)
  const fakeNov = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 3616,
      lifestyleBurnDaily: 0,
      nextPayday: new Date("2026-11-13T12:00:00"),
      paydayAnchorDay: 13,
    },
    coxBills,
    {
      asOf: new Date("2026-11-01T12:00:00"),
      horizonDays: 90,
      payrollDeposits: [
        { date: "2026-11-13", amount: 7689.86 },
        { date: "2026-11-27", amount: 3698.25 },
      ],
    }
  );
  assert(
    fakeNov.projectedLow < -1500 && (fakeNov.projectedLowDate ?? "").startsWith("2026-11"),
    `control shallow-liquid Nov path should stay deep-red got ${fakeNov.projectedLow} on ${fakeNov.projectedLowDate}`
  );

  // Production paste: Reserved $900 + "My Wife" shortfall on Sept 4 + Nov −$2174 with
  // Buffers $6985. Wife must not reserve, schedule, collide, or sink Timing.
  const wifeMandatory: KashuMoneyRow = {
    id: "wife-mandatory",
    type: "BILL",
    title: "My Wife",
    currentAmount: 900,
    dueDay: 4,
    autoPay: false,
    frequency: "BIWEEKLY",
    intervalDays: 14,
    nextDueDate: new Date("2026-09-04T12:00:00"),
    priority: "MANDATORY",
    confidence: 1,
  };
  const withWife = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 6985,
      lifestyleBurnDaily: 3,
      nextPayday: new Date("2026-08-21T12:00:00"),
      paydayAnchorDay: 21,
      monthlyTakeHome: 12361,
      typicalPaycheck: 5500,
      paycheckLow: 3698.25,
      paycheckHigh: 7689.86,
      incomeKind: "VARIABLE",
    },
    [...coxBills, wifeMandatory],
    {
      asOf: new Date("2026-08-21T12:00:00"),
      horizonDays: 90,
      liquidAsOf: "current",
      payrollDeposits: [
        { date: "2026-08-21", amount: 7689.86 },
        { date: "2026-09-04", amount: 3698.25 },
        { date: "2026-09-18", amount: 7689.86 },
        { date: "2026-10-02", amount: 3698.25 },
        { date: "2026-10-16", amount: 7689.86 },
        { date: "2026-10-30", amount: 3698.25 },
        { date: "2026-11-13", amount: 7689.86 },
        { date: "2026-11-27", amount: 3698.25 },
        { date: "2026-12-11", amount: 7689.86 },
        { date: "2026-12-25", amount: 3698.25 },
      ],
    }
  );
  assert(
    withWife.radar.some((e) => /wife/i.test(e.title)),
    "My Wife should appear on the calendar"
  );
  const wifeRadar = withWife.radar.filter((e) => /wife/i.test(e.title));
  assert(wifeRadar.length >= 1, "My Wife should schedule at least once");
  // Same-day as payday: balance must reflect the −$900 (not a ghost chip).
  const paydayWithWife = withWife.days.find((d) => d.date === "2026-09-04");
  if (paydayWithWife) {
    const wifeOnDay = paydayWithWife.events.some((e) => /wife/i.test(e.title));
    assert(wifeOnDay, "My Wife event must be on Sept 4 day projection");
    assert(
      paydayWithWife.obligations >= 900,
      `My Wife must debit day obligations got ${paydayWithWife.obligations}`
    );
  }
  assert(
    withWife.reservedObligations > 2000,
    `on payday, reserved must cover bills (+ wife) through next deposit got ${withWife.reservedObligations}`
  );
  assert(
    !/My Wife/i.test(withWife.message) || withWife.projectedLow > 0,
    `home message must not invent a Wife-only crisis got ${withWife.message}`
  );
  assert(
    withWife.projectedLow > 0 && Math.abs(withWife.projectedLow + 2174) > 500,
    `Buffers $6985 + Wife row must not reproduce −$2174 got ${withWife.projectedLow} on ${withWife.projectedLowDate}`
  );
  assert(
    withWife.safeToSpend <= Math.round(withWife.projectedLow) + 1,
    `safe-to-spend must not exceed projected low got safe=${withWife.safeToSpend} low=${withWife.projectedLow}`
  );

  // Timing must still never suggest moving My Wife
  assert(
    withWife.timingScenarios.every(
      (s) => !/wife/i.test(s.billTitle) && !(s.moves ?? []).some((m) => /wife/i.test(m.billTitle))
    ),
    "Timing must never suggest moving My Wife"
  );

  // Same-day: payday before obligation — thin morning cash + bill on payday must not collide.
  const sameDayBill: KashuMoneyRow = {
    id: "same-day-util",
    type: "BILL",
    title: "Same Day Utility",
    currentAmount: 900,
    dueDay: 4,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  };
  const sameDay = buildKashuForecast(
    {
      ...biweeklyProfile,
      liquidBalance: 200,
      lifestyleBurnDaily: 0,
      safetyFloor: 0,
      nextPayday: new Date("2026-09-04T12:00:00"),
      paydayAnchorDay: 4,
    },
    [sameDayBill],
    {
      asOf: new Date("2026-09-01T12:00:00"),
      horizonDays: 30,
      liquidAsOf: "current",
      payrollDeposits: [{ date: "2026-09-04", amount: 3698.25 }],
    }
  );
  assert(
    !sameDay.collisions.some((c) => c.date === "2026-09-04"),
    `payday must apply before same-day bill (no false shortfall) got ${JSON.stringify(sameDay.collisions)}`
  );
}

console.log("kashu forecast-engine smoke: ok");

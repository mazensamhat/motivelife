/**
 * Pre-release household audit — statement-backed Cox/TD facts vs current engine.
 * Run: npx tsx apps/web/src/lib/kashu/pre-release-household-audit.ts
 *
 * No live DB in this environment; rebuilds from statement numbers the user
 * presented (Jul 31 close, Cox bands, due-day bills, Wife e-transfer once).
 */
import { writeFileSync } from "node:fs";
import {
  buildKashuForecast,
  isTimingExcludedItem,
  type KashuMoneyRow,
  type KashuProfileRow,
} from "./forecast";
import { buildRollForwardEvents, chooseLiquidBalance, rollBalanceToAsOf } from "./liquid";

const JUL31_CLOSE = 4517.32;
const COX_LOW = 3698.25;
const COX_HIGH = 7689.86;
const WIFE = 900;

const coreBills: KashuMoneyRow[] = [
  {
    id: "sandpiper",
    type: "BILL",
    title: "Sandpiper Energy",
    currentAmount: 59,
    dueDay: 2,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "NECESSARY",
    confidence: 1,
  },
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
    id: "netflix",
    type: "SUBSCRIPTION",
    title: "Netflix",
    currentAmount: 27.11,
    dueDay: 13,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "DISCRETIONARY",
    confidence: 1,
  },
  {
    id: "lincoln",
    type: "DEBT",
    title: "Lincoln Auto",
    currentAmount: 380,
    dueDay: 25,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
    confidence: 1,
  },
  {
    id: "enwin",
    type: "BILL",
    title: "Enwin Utilities",
    currentAmount: 401,
    dueDay: 26,
    autoPay: true,
    frequency: "MONTHLY",
    intervalDays: null,
    nextDueDate: null,
    priority: "MANDATORY",
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
  {
    id: "tax",
    type: "BILL",
    title: "Windsor Property Tax",
    currentAmount: 807,
    dueDay: 28,
    autoPay: false,
    frequency: "ANNUAL",
    intervalDays: null,
    nextDueDate: new Date("2026-08-28T12:00:00"),
    priority: "MANDATORY",
    confidence: 1,
  },
];

const wifeItem: KashuMoneyRow = {
  id: "wife",
  type: "BILL",
  title: "My Wife",
  currentAmount: WIFE,
  dueDay: 4,
  autoPay: false,
  frequency: "BIWEEKLY",
  intervalDays: 14,
  nextDueDate: new Date("2026-09-04T12:00:00"),
  priority: "MANDATORY",
  confidence: 1,
};

const coxThroughYearEnd = [
  { date: "2026-08-07", amount: COX_LOW },
  { date: "2026-08-21", amount: COX_HIGH },
  { date: "2026-09-04", amount: COX_LOW },
  { date: "2026-09-18", amount: COX_HIGH },
  { date: "2026-10-02", amount: COX_LOW },
  { date: "2026-10-16", amount: COX_HIGH },
  { date: "2026-10-30", amount: COX_LOW },
  { date: "2026-11-13", amount: COX_HIGH },
  { date: "2026-11-27", amount: COX_LOW },
  { date: "2026-12-11", amount: COX_HIGH },
  { date: "2026-12-25", amount: COX_LOW },
];

const baseProfile: KashuProfileRow = {
  liquidBalance: null,
  safetyFloor: 0,
  emergencyReserve: 0,
  payFrequency: "BIWEEKLY",
  nextPayday: new Date("2026-08-21T12:00:00"),
  paydayAnchorDay: 21,
  lifestyleBurnDaily: 0,
  monthlyTakeHome: 12361,
  typicalPaycheck: 5500,
  paycheckLow: COX_LOW,
  paycheckHigh: COX_HIGH,
  incomeKind: "VARIABLE",
};

function handAugustPath() {
  // Jul 31 close → Aug 21 morning with Wife once on Aug 7 (posted transfer)
  const steps: Array<{ date: string; note: string; delta: number; bal: number }> = [];
  let bal = JUL31_CLOSE;
  const posts: Array<{ date: string; note: string; delta: number }> = [
    { date: "2026-08-02", note: "Sandpiper", delta: -59 },
    { date: "2026-08-03", note: "RBC Mortgage", delta: -3888.61 },
    { date: "2026-08-06", note: "Aviva", delta: -1152.14 },
    { date: "2026-08-07", note: "Cox low", delta: COX_LOW },
    { date: "2026-08-07", note: "E-TRANSFER My Wife", delta: -WIFE },
    { date: "2026-08-10", note: "Bell", delta: -690.17 },
    { date: "2026-08-13", note: "Netflix", delta: -27.11 },
  ];
  for (const p of posts) {
    bal = Math.round((bal + p.delta) * 100) / 100;
    steps.push({ ...p, bal });
  }
  const aug6 = steps.find((s) => s.date === "2026-08-06")!.bal;
  const aug21Morning = bal;
  bal = Math.round((bal + COX_HIGH) * 100) / 100;
  const afterAug21Pay = bal;
  for (const p of [
    { date: "2026-08-25", note: "Lincoln", delta: -380 },
    { date: "2026-08-26", note: "Enwin", delta: -401 },
    { date: "2026-08-26", note: "Enbridge", delta: -847 },
    { date: "2026-08-28", note: "Windsor Tax", delta: -807 },
  ]) {
    bal = Math.round((bal + p.delta) * 100) / 100;
    steps.push({ ...p, bal });
  }
  return {
    aug6Trough: aug6,
    aug21Morning,
    afterAug21Pay,
    aug28End: bal,
    steps,
  };
}

function summarizeForecast(
  label: string,
  f: ReturnType<typeof buildKashuForecast>,
  asOfYmd: string
) {
  const today = f.days.find((d) => d.date === asOfYmd);
  const nov12 = f.days.find((d) => d.date === "2026-11-12");
  const wifeRadar = f.radar.filter((e) => /wife/i.test(e.title));
  const wifeTips = f.timingScenarios.filter(
    (s) => /wife/i.test(s.billTitle) || (s.moves ?? []).some((m) => /wife/i.test(m.billTitle))
  );
  const paydayCount =
    f.statementPayroll?.length ?? f.radar.filter((e) => e.kind === "payday" && e.date >= asOfYmd).length;
  const paydayAmts = (
    f.statementPayroll?.map((p) => p.amount) ??
    f.radar.filter((e) => e.kind === "payday").map((e) => e.amount)
  ).filter((n) => n > 0);
  const avgPay =
    paydayAmts.length > 0
      ? Math.round(paydayAmts.reduce((s, n) => s + n, 0) / paydayAmts.length)
      : 0;
  return {
    label,
    liquidBalance: f.liquidBalance,
    reserved: f.reservedObligations,
    safeToSpend: f.safeToSpend,
    projectedLow: Math.round(f.projectedLow * 100) / 100,
    projectedLowDate: f.projectedLowDate,
    nextPayday: f.nextPayday,
    message: f.message,
    tipCount: f.timingScenarios.length,
    tips: f.timingScenarios.slice(0, 6).map((t) => ({
      title: t.billTitle,
      move: t.moves
        ? t.moves.map((m) => `${m.billTitle} ${m.currentDueDay}→${m.moveToDay}`).join("; ")
        : `${t.currentDueDay}→${t.moveToDay}`,
      softensTo: Math.round(t.projectedLow),
      lift: Math.round(t.projectedLow - f.projectedLow),
    })),
    today: today
      ? {
          start: today.startingBalance,
          end: today.endingBalance,
          in: today.income,
          out: today.obligations,
        }
      : null,
    nov12End: nov12 ? Math.round(nov12.endingBalance) : null,
    wifeRadarCount: wifeRadar.length,
    wifeTipCount: wifeTips.length,
    wifeCollisions: f.collisions.filter((c) => /wife/i.test(c.title)),
    collisions: f.collisions.slice(0, 5),
    paydayCount,
    avgPay,
    sampleDays: ["2026-08-21", "2026-09-03", "2026-09-04", "2026-11-12", "2026-11-13"]
      .map((d) => {
        const day = f.days.find((x) => x.date === d);
        if (!day) return null;
        return {
          date: d,
          start: day.startingBalance,
          end: day.endingBalance,
          in: day.income,
          out: Math.round(day.obligations),
        };
      })
      .filter(Boolean),
  };
}

function main() {
  const hand = handAugustPath();

  // Roll-forward from Jul 31 using money items + Cox + posted Wife transfer
  const rollEvents = buildRollForwardEvents({
    items: coreBills,
    payroll: coxThroughYearEnd.filter((p) => p.date <= "2026-08-21"),
    fromYmd: "2026-07-31",
    toYmd: "2026-08-21",
    windowTxs: [
      {
        date: "2026-08-07",
        amount: WIFE,
        direction: "debit",
      },
    ],
  });
  const rolledMorning = rollBalanceToAsOf({
    opening: JUL31_CLOSE,
    anchorYmd: "2026-07-31",
    asOfYmd: "2026-08-21",
    events: rollEvents,
  });

  const liquidChoiceBuffers = chooseLiquidBalance(6985, rolledMorning);
  const liquidChoiceEmpty = chooseLiquidBalance(null, rolledMorning);

  const asOf = new Date("2026-08-21T12:00:00");
  const horizon = 90;
  const depositsFromAsOf = coxThroughYearEnd.filter((p) => p.date >= "2026-08-21");

  // A) Statement truth path: morning liquid $1498.54, morning semantics (payday credits)
  const stmtMorning = buildKashuForecast(
    { ...baseProfile, liquidBalance: hand.aug21Morning },
    [...coreBills, wifeItem],
    {
      asOf,
      horizonDays: horizon,
      liquidAsOf: "morning",
      payrollDeposits: depositsFromAsOf,
    }
  );

  // B) Buffers path: user typed ~$6985 as bank-now on payday morning/after
  const buffersCurrent = buildKashuForecast(
    { ...baseProfile, liquidBalance: 6985, lifestyleBurnDaily: 3 },
    [...coreBills, wifeItem],
    {
      asOf,
      horizonDays: horizon,
      liquidAsOf: "current",
      payrollDeposits: depositsFromAsOf,
    }
  );

  // C) Control: Buffers without Wife row (should match B on trough class)
  const buffersNoWife = buildKashuForecast(
    { ...baseProfile, liquidBalance: 6985, lifestyleBurnDaily: 3 },
    coreBills,
    {
      asOf,
      horizonDays: horizon,
      liquidAsOf: "current",
      payrollDeposits: depositsFromAsOf,
    }
  );

  // D) Broken path that previously mimicked production: morning semantics on $6985
  const buffersMorningBug = buildKashuForecast(
    { ...baseProfile, liquidBalance: 6985, lifestyleBurnDaily: 0 },
    coreBills,
    {
      asOf,
      horizonDays: 30,
      liquidAsOf: "morning",
      payrollDeposits: depositsFromAsOf,
    }
  );

  const checks = {
    wifeExcludedByTitle: isTimingExcludedItem(wifeItem),
    handAug21MorningNear1498: Math.abs(hand.aug21Morning - 1498.54) < 0.02,
    handAug6TroughNearNeg582: Math.abs(hand.aug6Trough - -582.43) < 0.5,
    rollMatchesHand: Math.abs(rolledMorning - hand.aug21Morning) < 1,
    stmtProjectedLowNonNegative: stmtMorning.projectedLow >= 0,
    stmtNov12Positive: (stmtMorning.days.find((d) => d.date === "2026-11-12")?.endingBalance ?? -1) > 0,
    stmtNoWifeRadar: stmtMorning.radar.every((e) => !/wife/i.test(e.title)),
    stmtNoWifeTips: stmtMorning.timingScenarios.every((s) => !/wife/i.test(s.billTitle)),
    buffersReservedNot900: buffersCurrent.reservedObligations !== 900,
    buffersSafeNearTrough:
      Math.abs(buffersCurrent.safeToSpend - Math.round(buffersCurrent.projectedLow)) <= 1,
    buffersNoWifeCollision: !buffersCurrent.collisions.some((c) => /wife/i.test(c.title)),
    buffersNoNeg2174: Math.abs(buffersCurrent.projectedLow + 2174) > 500,
    buffersProjectedLowPositive: buffersCurrent.projectedLow > 0,
    buffersTodayPinned:
      Math.abs((buffersCurrent.days.find((d) => d.date === "2026-08-21")?.endingBalance ?? 0) - 6985) <
      1,
    buffersWifeVsNoWifeSameLow:
      Math.abs(buffersCurrent.projectedLow - buffersNoWife.projectedLow) < 1,
    buffersReservedCoversNextCycle: buffersCurrent.reservedObligations > 2000,
    morningBugStacksPayday:
      Math.abs((buffersMorningBug.days.find((d) => d.date === "2026-08-21")?.endingBalance ?? 0) - 6985) >
      1000,
    chooseLiquidKeepsBuffers: liquidChoiceBuffers.source === "profile",
    chooseLiquidEmptyUsesLedger: liquidChoiceEmpty.source === "ledger",
  };

  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const dossier = {
    generatedAt: new Date().toISOString(),
    branch: "cursor/kashu-pin-today-balance-eb50",
    commit: "8d0e6ef",
    scopeNote:
      "Live production DB is not reachable from this cloud agent (no DATABASE_URL). Audit uses statement-backed reconstruction the user presented as accurate.",
    statementFacts: {
      jul31Close: JUL31_CLOSE,
      coxLow: COX_LOW,
      coxHigh: COX_HIGH,
      wifeTransferOnceAug7: WIFE,
      bills: coreBills.map((b) => ({
        title: b.title,
        amount: b.currentAmount,
        dueDay: b.dueDay,
        frequency: b.frequency,
      })),
    },
    handAugust: hand,
    rollForward: {
      rolledMorning: Math.round(rolledMorning * 100) / 100,
      eventCount: rollEvents.length,
    },
    liquidChoice: {
      buffers6985: liquidChoiceBuffers,
      emptyBuffers: liquidChoiceEmpty,
    },
    scenarios: {
      statementMorning1498: summarizeForecast("statement morning $1498.54", stmtMorning, "2026-08-21"),
      buffersCurrent6985: summarizeForecast("Buffers current $6985 + $3 burn", buffersCurrent, "2026-08-21"),
      buffersNoWife: summarizeForecast("Buffers $6985 no Wife row", buffersNoWife, "2026-08-21"),
      buffersMorningBug: summarizeForecast(
        "BUG control: morning semantics on $6985",
        buffersMorningBug,
        "2026-08-21"
      ),
    },
    checks,
    failedChecks: failed,
    engineSelfVerdict: failed.length === 0 ? "PASS" : "FAIL",
    reviewerQuestions: [
      "Q1: Is Jul31 $4517.32 → Aug21 morning ≈ $1498.54 (with Wife −$900 once on Aug7) correct hand math?",
      "Q2: With statement morning liquid + Cox + core bills + $0 burn, should projected low stay ≥ $0 and Nov12 stay strongly positive?",
      "Q3: Should My Wife (family e-transfer) be excluded from Reserved, Timing tips, and cash-map obligations?",
      "Q4: With Buffers $6985 + liquidAsOf=current on payday, must TODAY end ≈ $6985 (not ≈ $14k) and must we reject Nov −$2174?",
      "Q5: Is this statement-backed path ready to trust for public release of Timing/Calendar, assuming statements are accurate?",
      "Q6: Caveats that must stay on the release note (rounding, lifestyle burn, DayO extras, live DB not queried)?",
    ],
  };

  const outPath = "/opt/cursor/artifacts/pre_release_household_dossier.json";
  writeFileSync(outPath, JSON.stringify(dossier, null, 2));

  const lines = [
    "PRE-RELEASE HOUSEHOLD AUDIT (statement-backed)",
    "==============================================",
    `Engine self-verdict: ${dossier.engineSelfVerdict}`,
    `Failed checks: ${failed.length ? failed.join(", ") : "none"}`,
    "",
    `Hand Aug6 trough: ${hand.aug6Trough}`,
    `Hand Aug21 morning: ${hand.aug21Morning}`,
    `Roll-forward Aug21 morning: ${Math.round(rolledMorning * 100) / 100}`,
    "",
    "Statement morning path:",
    `  low ${dossier.scenarios.statementMorning1498.projectedLow} on ${dossier.scenarios.statementMorning1498.projectedLowDate}`,
    `  Nov12 ${dossier.scenarios.statementMorning1498.nov12End}`,
    `  tips ${dossier.scenarios.statementMorning1498.tipCount}`,
    `  wife radar ${dossier.scenarios.statementMorning1498.wifeRadarCount}`,
    "",
    "Buffers $6985 current path:",
    `  reserved ${dossier.scenarios.buffersCurrent6985.reserved} safe ${dossier.scenarios.buffersCurrent6985.safeToSpend}`,
    `  low ${dossier.scenarios.buffersCurrent6985.projectedLow} on ${dossier.scenarios.buffersCurrent6985.projectedLowDate}`,
    `  TODAY end ${dossier.scenarios.buffersCurrent6985.today?.end}`,
    `  Nov12 ${dossier.scenarios.buffersCurrent6985.nov12End}`,
    `  wife collisions ${dossier.scenarios.buffersCurrent6985.wifeCollisions.length}`,
    "",
    `Bug control TODAY end (morning on 6985): ${dossier.scenarios.buffersMorningBug.today?.end}`,
    "",
    `Dossier: ${outPath}`,
  ];
  const logPath = "/opt/cursor/artifacts/pre_release_household_audit.log";
  writeFileSync(logPath, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

main();

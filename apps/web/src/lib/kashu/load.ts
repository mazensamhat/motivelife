import { prisma } from "@forward/database";
import type {
  KashuForecast,
  KashuForecastBundle,
  KashuIncomeScenario,
  KashuLifeOsInsight,
  KashuProfileFields,
  KashuTransitionState,
} from "@forward/shared";
import { isCommitmentType } from "@forward/shared";
import {
  buildKashuForecast,
  isTimingExcludedItem,
  normalizeIncomeKind,
  obligationDatesInRange,
  type KashuMoneyRow,
  type KashuProfileRow,
} from "@/lib/kashu/forecast";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import {
  blendConfidence,
  rememberForecast,
  toLearningSummary,
} from "@/lib/kashu/learning";
import { loadLearningState, saveLearningState } from "@/lib/kashu/learning-store";
import { loadKashuLifeOsInputs } from "@/lib/kashu/life-os";
import { derivePayRhythm } from "@/lib/kashu/pay-rhythm";
import {
  detectPayrollDeposits,
  reconstructPayCadence,
  seedPayrollFromAnchor,
} from "@/lib/kashu/payroll-detect";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";
import {
  chooseLiquidBalance,
  daysBetweenYmd,
  rollBalanceToAsOf,
} from "@/lib/kashu/liquid";

type ProfileSource = {
  liquidBalance: number | null;
  safetyFloor: number | null;
  emergencyReserve: number | null;
  payFrequency: string | null;
  nextPayday: Date | null;
  paydayAnchorDay: number | null;
  lifestyleBurnDaily: number | null;
  monthlyTakeHome: number | null;
  typicalPaycheck?: number | null;
  incomeKind?: string | null;
  incomeConservative?: number | null;
  incomeHigh?: number | null;
  transitionJson: string | null;
};

export function toKashuProfileFields(row: ProfileSource): KashuProfileFields {
  return {
    liquidBalance: row.liquidBalance,
    safetyFloor: row.safetyFloor ?? 0,
    emergencyReserve: row.emergencyReserve ?? 0,
    payFrequency: (row.payFrequency as KashuProfileFields["payFrequency"]) ?? null,
    nextPayday: row.nextPayday?.toISOString() ?? null,
    paydayAnchorDay: row.paydayAnchorDay,
    lifestyleBurnDaily: row.lifestyleBurnDaily ?? 0,
    monthlyTakeHome: row.monthlyTakeHome,
    typicalPaycheck: row.typicalPaycheck ?? null,
    incomeKind: normalizeIncomeKind(row.incomeKind),
    incomeConservative: row.incomeConservative ?? null,
    incomeHigh: row.incomeHigh ?? null,
    transitionJson: row.transitionJson,
  };
}

export function toKashuProfileRow(row: ProfileSource): KashuProfileRow {
  return {
    liquidBalance: row.liquidBalance,
    safetyFloor: row.safetyFloor,
    emergencyReserve: row.emergencyReserve,
    payFrequency: row.payFrequency,
    nextPayday: row.nextPayday,
    paydayAnchorDay: row.paydayAnchorDay,
    lifestyleBurnDaily: row.lifestyleBurnDaily,
    monthlyTakeHome: row.monthlyTakeHome,
    typicalPaycheck: row.typicalPaycheck ?? null,
    incomeKind: row.incomeKind,
    incomeConservative: row.incomeConservative,
    incomeHigh: row.incomeHigh,
  };
}

export function toKashuMoneyRows(
  items: Array<{
    id: string;
    type: string;
    title: string;
    currentAmount: number;
    targetAmount?: number | null;
    dueDay: number | null;
    autoPay: boolean;
    frequency: string | null;
    intervalDays: number | null;
    nextDueDate: Date | null;
    priority: string | null;
    confidence: number | null;
  }>
): KashuMoneyRow[] {
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    currentAmount: i.currentAmount,
    targetAmount: i.targetAmount ?? null,
    dueDay: i.dueDay,
    autoPay: i.autoPay,
    frequency: i.frequency,
    intervalDays: i.intervalDays,
    nextDueDate: i.nextDueDate,
    priority: i.priority,
    confidence: i.confidence,
  }));
}

function buildForecastBundle(
  profileRow: KashuProfileRow,
  items: KashuMoneyRow[],
  opts?: {
    horizonDays?: number;
    active?: KashuIncomeScenario;
    extraDailyBurn?: number;
    extraSpendByDate?: Record<string, { title: string; amount: number }>;
    payrollDeposits?: Array<{ date: string; amount: number }>;
  }
): { forecast: KashuForecast; forecasts: KashuForecastBundle | null } {
  const horizonDays = opts?.horizonDays;
  const extras = {
    extraDailyBurn: opts?.extraDailyBurn,
    extraSpendByDate: opts?.extraSpendByDate,
    payrollDeposits: opts?.payrollDeposits,
  };
  const buildOpts = {
    ...(horizonDays != null ? { horizonDays } : {}),
    ...extras,
  };
  const active = opts?.active ?? "expected";
  const kind = normalizeIncomeKind(profileRow.incomeKind);

  const expected = buildKashuForecast(profileRow, items, {
    ...buildOpts,
    incomeScenario: "expected",
  });

  if (kind !== "VARIABLE") {
    return {
      forecast:
        active === "expected"
          ? expected
          : buildKashuForecast(profileRow, items, {
              ...buildOpts,
              incomeScenario: active,
            }),
      forecasts: null,
    };
  }

  const conservative = buildKashuForecast(profileRow, items, {
    ...buildOpts,
    incomeScenario: "conservative",
  });
  const high = buildKashuForecast(profileRow, items, {
    ...buildOpts,
    incomeScenario: "high",
  });
  const forecasts: KashuForecastBundle = {
    active,
    conservative,
    expected,
    high,
  };
  const forecast =
    active === "conservative"
      ? conservative
      : active === "high"
        ? high
        : expected;

  return { forecast, forecasts };
}

/**
 * Resolve today's checking balance from statement txs / endingBalance when Buffers
 * is missing or stale. Decision rules live in chooseLiquidBalance().
 * Returns `anchorYmd` so callers can roll the close forward to asOf when newer
 * txs are missing.
 */
export async function resolveLiquidFromLedger(
  userId: string,
  profileLiquid: number | null
): Promise<{
  liquid: number | null;
  source: "profile" | "ledger" | "none";
  anchorYmd: string | null;
}> {
  let derived: number | null = null;
  let anchorAt: Date | null = null;

  try {
    const withBal = await prisma.kashuTransaction.findFirst({
      where: { userId, balanceAfter: { not: null } },
      orderBy: { postedAt: "desc" },
      select: { balanceAfter: true, postedAt: true },
    });
    if (withBal?.balanceAfter != null) {
      derived = withBal.balanceAfter;
      anchorAt = withBal.postedAt;
    }
  } catch {
    /* schema may lag */
  }

  if (derived == null) {
    try {
      const stmt = await prisma.kashuStatement.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { parsedJson: true, createdAt: true, id: true },
      });
      if (stmt?.parsedJson) {
        const parsed = JSON.parse(stmt.parsedJson) as { endingBalance?: number | null };
        if (typeof parsed.endingBalance === "number") {
          derived = parsed.endingBalance;
          const lastOnStmt = await prisma.kashuTransaction.findFirst({
            where: { userId, statementId: stmt.id },
            orderBy: { postedAt: "desc" },
            select: { postedAt: true },
          });
          anchorAt = lastOnStmt?.postedAt ?? stmt.createdAt;
        }
      }
    } catch {
      /* ignore */
    }
  }

  let appliedLaterTx = false;
  if (derived != null && anchorAt) {
    try {
      const later = await prisma.kashuTransaction.findMany({
        where: { userId, postedAt: { gt: anchorAt } },
        orderBy: { postedAt: "asc" },
        take: 400,
        select: { amount: true, direction: true, balanceAfter: true, postedAt: true },
      });
      for (const t of later) {
        appliedLaterTx = true;
        if (t.balanceAfter != null) {
          derived = t.balanceAfter;
          anchorAt = t.postedAt;
          continue;
        }
        if (t.direction === "credit") derived += t.amount;
        else derived -= t.amount;
        anchorAt = t.postedAt;
      }
    } catch {
      /* ignore */
    }
  }

  const chosen = chooseLiquidBalance(profileLiquid, derived);
  const anchorYmd = anchorAt ? anchorAt.toISOString().slice(0, 10) : null;
  return {
    ...chosen,
    // Only expose anchor when we still need a schedule roll (no fresh txs to today).
    anchorYmd:
      chosen.source === "ledger" && anchorYmd && !appliedLaterTx
        ? anchorYmd
        : chosen.source === "ledger" && anchorYmd && appliedLaterTx
          ? anchorYmd
          : chosen.source === "ledger"
            ? anchorYmd
            : null,
  };
}

/** Build signed cash events (payroll +, bills −) to roll a statement close to asOf. */
export function buildRollForwardEvents(opts: {
  items: KashuMoneyRow[];
  payroll: Array<{ date: string; amount: number }>;
  fromYmd: string;
  toYmd: string;
}): Array<{ date: string; amount: number }> {
  const from = new Date(`${opts.fromYmd}T12:00:00`);
  const to = new Date(`${opts.toYmd}T12:00:00`);
  const events: Array<{ date: string; amount: number }> = [];

  for (const p of opts.payroll) {
    if (p.date > opts.fromYmd && p.date < opts.toYmd && p.amount > 0) {
      events.push({ date: p.date, amount: p.amount });
    }
  }

  for (const item of opts.items) {
    if (isTimingExcludedItem(item)) continue;
    if (!isCommitmentType(item.type) && item.type !== "DEBT" && item.type !== "HOUSING") {
      // Still include subscriptions that hit cash
      if (item.type !== "SUBSCRIPTION" && item.type !== "BILL") continue;
    }
    const dates = obligationDatesInRange(item, from, to);
    for (const d of dates) {
      const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (y > opts.fromYmd && y < opts.toYmd) {
        events.push({ date: y, amount: -Math.abs(item.currentAmount) });
      }
    }
  }
  return events;
}

export async function loadKashuForecast(
  userId: string,
  opts?: { horizonDays?: number; incomeScenario?: KashuIncomeScenario }
): Promise<{
  profile: KashuProfileFields;
  forecast: KashuForecast;
  forecasts: KashuForecastBundle | null;
  pendingRecurring: number;
  statementsCount: number;
}> {
  await ensureKashuSchema();

  const [profileRow, items, pendingRecurring, statementsCount, incomeTxs] = await Promise.all([
    getOrCreateFinancialProfile(userId),
    prisma.moneyItem.findMany({ where: { userId } }),
    prisma.kashuRecurringCandidate.count({ where: { userId, status: "pending" } }),
    prisma.kashuStatement.count({ where: { userId } }),
    prisma.kashuTransaction
      .findMany({
        where: {
          userId,
          direction: "credit",
          amount: { gte: 500 },
        },
        orderBy: { postedAt: "asc" },
        take: 120,
        select: {
          postedAt: true,
          amount: true,
          description: true,
          classification: true,
          direction: true,
        },
      })
      .catch(() => [] as Array<{
        postedAt: Date;
        amount: number;
        description: string;
        classification: string | null;
        direction: string;
      }>),
  ]);

  const profileSource = profileRow as ProfileSource;
  const profileForForecast = toKashuProfileRow(profileSource);

  // Statement ledger wins over empty / stale Buffers so Timing cannot invent a −$6k month.
  // May still be a *period close* — rolled to asOf after payroll/bills are known below.
  const liquidResolved = await resolveLiquidFromLedger(userId, profileForForecast.liquidBalance);
  if (
    liquidResolved.source === "ledger" &&
    liquidResolved.liquid != null &&
    liquidResolved.liquid !== profileForForecast.liquidBalance
  ) {
    profileForForecast.liquidBalance = liquidResolved.liquid;
    profileSource.liquidBalance = liquidResolved.liquid;
  }

  // Always prefer statement payroll history over stale Buffers monthly math.
  // Expert pattern (Fintract): cadence + amount variance, exclude e-transfers.
  let payrollDeposits = detectPayrollDeposits(
    incomeTxs.map((t) => ({
      postedAt: t.postedAt.toISOString().slice(0, 10),
      amount: t.amount,
      description: t.description,
      classification: t.classification,
      direction: t.direction,
    }))
  );

  // Seed from profile next payday when statements missed a deposit (common OCR miss).
  const profileNextYmd = profileForForecast.nextPayday
    ? profileForForecast.nextPayday.toISOString().slice(0, 10)
    : null;
  const asOfSeed = new Date().toISOString().slice(0, 10);
  payrollDeposits = seedPayrollFromAnchor({
    deposits: payrollDeposits,
    nextPayday: profileNextYmd,
    typicalAmount:
      profileForForecast.typicalPaycheck ??
      (profileForForecast.monthlyTakeHome
        ? Math.round(profileForForecast.monthlyTakeHome / 2.17)
        : 0),
    asOfYmd: asOfSeed,
  });

  const rhythm = derivePayRhythm(payrollDeposits);
  if (rhythm) {
    profileForForecast.typicalPaycheck = rhythm.typicalPaycheck;
    profileForForecast.paycheckLow = rhythm.lowBand;
    profileForForecast.paycheckHigh = rhythm.highBand;
    profileForForecast.payFrequency = rhythm.payFrequency;
    profileForForecast.monthlyTakeHome = rhythm.monthlyTakeHome;
    profileForForecast.nextPayday = new Date(`${rhythm.nextPayday}T12:00:00`);
    if (rhythm.lowBand && rhythm.highBand) {
      profileForForecast.incomeKind = "VARIABLE";
    }

    // Persist so Buffers / payday UI stay in sync
    void prisma.$executeRaw`
      UPDATE "FinancialProfile"
      SET "typicalPaycheck" = ${rhythm.typicalPaycheck},
          "monthlyTakeHome" = ${rhythm.monthlyTakeHome},
          "payFrequency" = ${rhythm.payFrequency},
          "nextPayday" = ${new Date(`${rhythm.nextPayday}T12:00:00`)}
      WHERE "userId" = ${userId}
    `.catch(() => {});
  }

  const moneyRows = toKashuMoneyRows(items);
  const nextPayday = profileForForecast.nextPayday
    ? profileForForecast.nextPayday.toISOString().slice(0, 10)
    : null;

  const lifeOs = await loadKashuLifeOsInputs(userId, profileForForecast, moneyRows, nextPayday).catch(
    (): {
      insights: KashuLifeOsInsight[];
      extraDailyBurn: number;
      extraSpendByDate: Record<string, { title: string; amount: number }>;
    } => ({
      insights: [],
      extraDailyBurn: 0,
      extraSpendByDate: {},
    })
  );

  // Reconstruct payroll cadence BEFORE forecasting so day balances + Timing use real deposits.
  const asOfSeedYmd = new Date().toISOString().slice(0, 10);
  const step =
    rhythm?.payFrequency === "WEEKLY"
      ? 7
      : rhythm?.payFrequency === "MONTHLY"
        ? 30
        : 14;
  const lookbackFrom = (() => {
    const d = new Date(`${asOfSeedYmd}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - Math.max(opts?.horizonDays ?? 45, 62));
    return d.toISOString().slice(0, 10);
  })();
  const lookbackTo = (() => {
    const d = new Date(`${asOfSeedYmd}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (opts?.horizonDays ?? 45));
    return d.toISOString().slice(0, 10);
  })();
  const cadencePays = reconstructPayCadence(
    payrollDeposits,
    step,
    lookbackFrom,
    lookbackTo
  );
  const payrollForSim = cadencePays.map((p) => ({
    date: p.postedAt,
    amount: Math.round(p.amount),
  }));

  // Roll a stale statement close forward to this morning using known payroll + bills.
  // Without this, Jul 31 $4,517 gets treated as Aug 21 cash and Timing understates risk.
  if (
    liquidResolved.source === "ledger" &&
    liquidResolved.liquid != null &&
    liquidResolved.anchorYmd &&
    daysBetweenYmd(liquidResolved.anchorYmd, asOfSeedYmd) > 0
  ) {
    const rollEvents = buildRollForwardEvents({
      items: moneyRows,
      payroll: payrollForSim,
      fromYmd: liquidResolved.anchorYmd,
      toYmd: asOfSeedYmd,
    });
    const rolled = rollBalanceToAsOf({
      opening: liquidResolved.liquid,
      anchorYmd: liquidResolved.anchorYmd,
      asOfYmd: asOfSeedYmd,
      events: rollEvents,
    });
    profileForForecast.liquidBalance = rolled;
    profileSource.liquidBalance = rolled;
  }

  if (
    liquidResolved.source === "ledger" &&
    profileForForecast.liquidBalance != null &&
    profileForForecast.liquidBalance !== (profileRow as ProfileSource).liquidBalance
  ) {
    void prisma.financialProfile
      .update({
        where: { userId },
        data: { liquidBalance: profileForForecast.liquidBalance },
      })
      .catch(() => {});
  }

  const { forecast, forecasts } = buildForecastBundle(profileForForecast, moneyRows, {
    horizonDays: opts?.horizonDays,
    active: opts?.incomeScenario,
    extraDailyBurn: lifeOs.extraDailyBurn,
    extraSpendByDate: lifeOs.extraSpendByDate,
    payrollDeposits: payrollForSim,
  });

  let learning = await loadLearningState(userId).catch(() => null);
  if (learning) {
    if (!learning.lastForecast || learning.lastForecast.asOf !== forecast.asOf) {
      learning = rememberForecast(learning, forecast);
      await saveLearningState(userId, learning).catch(() => {});
    }
    forecast.forecastConfidence = blendConfidence(forecast.forecastConfidence, learning.accuracy);
    forecast.learning = toLearningSummary(learning);
    if (learning.lessons.length) {
      lifeOs.insights.push({
        id: "learning",
        source: "learning",
        title: "Predicted vs actual",
        detail: learning.lessons[0]!,
        href: "/kashu",
      });
    }
  }
  forecast.lifeOsInsights = lifeOs.insights;

  // Keep statementPayroll on the payload for calendar UI (exact vs cadence).
  const asOfYmd = forecast.asOf.slice(0, 10);
  const statementPayroll = cadencePays.map((p) => ({
    date: p.postedAt,
    amount: Math.round(p.amount),
    source: (p.synthetic ? "cadence" : "statement") as "statement" | "cadence",
  }));
  forecast.statementPayroll = statementPayroll;

  for (const p of statementPayroll) {
    const existing = forecast.radar.find(
      (e) =>
        e.date === p.date && (e.kind === "payday" || e.kind === "income")
    );
    if (existing) {
      // Prefer exact statement amount on past days
      if (p.date <= asOfYmd && p.source === "statement") {
        existing.amount = p.amount;
        existing.title = p.amount >= 5000 ? "Payday (Bonus)" : "Payday";
      }
      continue;
    }
    forecast.radar.push({
      id: `payroll-${p.date}-${p.source}`,
      date: p.date,
      kind: "payday",
      title: p.amount >= 5000 ? "Payday (Bonus)" : "Payday",
      amount: p.amount,
      balanceAfter: 0,
      status: "green",
      priority: "MANDATORY",
    });
  }
  forecast.radar.sort(
    (a, b) => a.date.localeCompare(b.date) || a.amount - b.amount
  );

  const profileOut = toKashuProfileFields({
    ...profileSource,
    typicalPaycheck: profileForForecast.typicalPaycheck ?? profileSource.typicalPaycheck,
    monthlyTakeHome: profileForForecast.monthlyTakeHome,
    payFrequency: profileForForecast.payFrequency,
    nextPayday: profileForForecast.nextPayday,
    incomeKind: profileForForecast.incomeKind,
  });

  return {
    profile: profileOut,
    forecast,
    forecasts,
    pendingRecurring,
    statementsCount,
  };
}

export function defaultTransitionState(): KashuTransitionState {
  return {
    oldAccountLabel: "",
    newAccountLabel: "",
    payrollMoved: false,
    oldOverdraftBalance: 0,
    notes: "",
    pads: [],
  };
}

export function parseTransitionJson(raw: string | null | undefined): KashuTransitionState {
  if (!raw) return defaultTransitionState();
  try {
    return { ...defaultTransitionState(), ...(JSON.parse(raw) as KashuTransitionState) };
  } catch {
    return defaultTransitionState();
  }
}

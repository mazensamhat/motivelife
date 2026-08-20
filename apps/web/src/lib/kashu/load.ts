import { prisma } from "@forward/database";
import type {
  KashuForecast,
  KashuForecastBundle,
  KashuIncomeScenario,
  KashuLifeOsInsight,
  KashuProfileFields,
  KashuTransitionState,
} from "@forward/shared";
import {
  buildKashuForecast,
  normalizeIncomeKind,
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
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

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
  }
): { forecast: KashuForecast; forecasts: KashuForecastBundle | null } {
  const horizonDays = opts?.horizonDays;
  const extras = {
    extraDailyBurn: opts?.extraDailyBurn,
    extraSpendByDate: opts?.extraSpendByDate,
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

  // Always prefer statement payroll history over stale Buffers monthly math
  const payrollDeposits = incomeTxs
    .filter(
      (t) =>
        t.classification === "income" ||
        /cox|payroll|salary|direct deposit|wage|\bmsp\b/i.test(t.description)
    )
    .map((t) => ({
      postedAt: t.postedAt.toISOString().slice(0, 10),
      amount: t.amount,
    }));

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

  const { forecast, forecasts } = buildForecastBundle(profileForForecast, moneyRows, {
    horizonDays: opts?.horizonDays,
    active: opts?.incomeScenario,
    extraDailyBurn: lifeOs.extraDailyBurn,
    extraSpendByDate: lifeOs.extraSpendByDate,
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

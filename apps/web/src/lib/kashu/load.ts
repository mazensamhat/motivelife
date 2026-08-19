import { prisma } from "@forward/database";
import type {
  KashuForecast,
  KashuForecastBundle,
  KashuIncomeScenario,
  KashuLifeOsInsight,
  KashuProfileFields,
  KashuTransitionState,
} from "@forward/shared";
import { formatMoney, normalizeCurrency, normalizeLocale } from "@forward/shared";
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

type ProfileSource = {
  liquidBalance: number | null;
  safetyFloor: number | null;
  emergencyReserve: number | null;
  payFrequency: string | null;
  nextPayday: Date | null;
  paydayAnchorDay: number | null;
  lifestyleBurnDaily: number | null;
  monthlyTakeHome: number | null;
  incomeKind?: string | null;
  incomeConservative?: number | null;
  incomeHigh?: number | null;
  preferredCurrency?: string | null;
  preferredLocale?: string | null;
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
    incomeKind: normalizeIncomeKind(row.incomeKind),
    incomeConservative: row.incomeConservative ?? null,
    incomeHigh: row.incomeHigh ?? null,
    preferredCurrency: normalizeCurrency(row.preferredCurrency),
    preferredLocale: normalizeLocale(row.preferredLocale),
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
    format?: { currency: string; locale: string };
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
    ...(opts?.format ? { format: opts.format } : {}),
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
  const [profileRow, items, pendingRecurring, statementsCount] = await Promise.all([
    getOrCreateFinancialProfile(userId),
    prisma.moneyItem.findMany({ where: { userId } }),
    prisma.kashuRecurringCandidate.count({ where: { userId, status: "pending" } }),
    prisma.kashuStatement.count({ where: { userId } }),
  ]);

  const profileSource = profileRow as ProfileSource;
  const profileForForecast = toKashuProfileRow(profileSource);
  const moneyRows = toKashuMoneyRows(items);
  const nextPayday = profileSource.nextPayday
    ? profileSource.nextPayday.toISOString().slice(0, 10)
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

  const profileFields = toKashuProfileFields(profileSource);
  const { forecast, forecasts } = buildForecastBundle(profileForForecast, moneyRows, {
    horizonDays: opts?.horizonDays,
    active: opts?.incomeScenario,
    extraDailyBurn: lifeOs.extraDailyBurn,
    extraSpendByDate: lifeOs.extraSpendByDate,
    format: {
      currency: profileFields.preferredCurrency,
      locale: profileFields.preferredLocale,
    },
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

  return {
    profile: profileFields,
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

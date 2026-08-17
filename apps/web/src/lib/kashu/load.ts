import { prisma } from "@forward/database";
import type {
  KashuForecast,
  KashuForecastBundle,
  KashuIncomeScenario,
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
  opts?: { horizonDays?: number; active?: KashuIncomeScenario }
): { forecast: KashuForecast; forecasts: KashuForecastBundle | null } {
  const horizonDays = opts?.horizonDays;
  const buildOpts = horizonDays != null ? { horizonDays } : {};
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

  const { forecast, forecasts } = buildForecastBundle(
    toKashuProfileRow(profileRow as ProfileSource),
    toKashuMoneyRows(items),
    { horizonDays: opts?.horizonDays, active: opts?.incomeScenario }
  );

  return {
    profile: toKashuProfileFields(profileRow as ProfileSource),
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

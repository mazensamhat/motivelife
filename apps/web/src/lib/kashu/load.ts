import { prisma } from "@forward/database";
import type { KashuForecast, KashuProfileFields, KashuTransitionState } from "@forward/shared";
import {
  buildKashuForecast,
  type KashuMoneyRow,
  type KashuProfileRow,
} from "@/lib/kashu/forecast";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";

export function toKashuProfileFields(row: {
  liquidBalance: number | null;
  safetyFloor: number | null;
  emergencyReserve: number | null;
  payFrequency: string | null;
  nextPayday: Date | null;
  paydayAnchorDay: number | null;
  lifestyleBurnDaily: number | null;
  transitionJson: string | null;
}): KashuProfileFields {
  return {
    liquidBalance: row.liquidBalance,
    safetyFloor: row.safetyFloor ?? 0,
    emergencyReserve: row.emergencyReserve ?? 0,
    payFrequency: (row.payFrequency as KashuProfileFields["payFrequency"]) ?? null,
    nextPayday: row.nextPayday?.toISOString() ?? null,
    paydayAnchorDay: row.paydayAnchorDay,
    lifestyleBurnDaily: row.lifestyleBurnDaily ?? 0,
    transitionJson: row.transitionJson,
  };
}

export function toKashuProfileRow(row: {
  liquidBalance: number | null;
  safetyFloor: number | null;
  emergencyReserve: number | null;
  payFrequency: string | null;
  nextPayday: Date | null;
  paydayAnchorDay: number | null;
  lifestyleBurnDaily: number | null;
  monthlyTakeHome: number | null;
}): KashuProfileRow {
  return {
    liquidBalance: row.liquidBalance,
    safetyFloor: row.safetyFloor,
    emergencyReserve: row.emergencyReserve,
    payFrequency: row.payFrequency,
    nextPayday: row.nextPayday,
    paydayAnchorDay: row.paydayAnchorDay,
    lifestyleBurnDaily: row.lifestyleBurnDaily,
    monthlyTakeHome: row.monthlyTakeHome,
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

export async function loadKashuForecast(userId: string): Promise<{
  profile: KashuProfileFields;
  forecast: KashuForecast;
  pendingRecurring: number;
  statementsCount: number;
}> {
  const [profileRow, items, pendingRecurring, statementsCount] = await Promise.all([
    getOrCreateFinancialProfile(userId),
    prisma.moneyItem.findMany({ where: { userId } }),
    prisma.kashuRecurringCandidate.count({ where: { userId, status: "pending" } }),
    prisma.kashuStatement.count({ where: { userId } }),
  ]);

  const forecast = buildKashuForecast(
    toKashuProfileRow(profileRow),
    toKashuMoneyRows(items)
  );

  return {
    profile: toKashuProfileFields(profileRow),
    forecast,
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

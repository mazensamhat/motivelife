import { prisma } from "@forward/database";
import type {
  AiUsageFeature,
  AiUsageSummary,
  VoiceOrganizeSource,
} from "@forward/shared";
import {
  PLUS_VOICE_ORGANIZE_CAP,
  TRIAL_VOICE_ORGANIZE_CAP,
  estimateOpenAiCostUsd,
  voiceOrganizeWeight,
} from "@forward/shared";
import type { OpenAiUsage } from "@forward/ai";
import { startOfDay } from "./api";
import { getSubscriptionTier, type SubscriptionTier } from "./subscription";

export function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type { SubscriptionTier } from "./subscription";

export function voiceOrganizeCapForTier(tier: SubscriptionTier): number {
  if (tier === "plus") return PLUS_VOICE_ORGANIZE_CAP;
  if (tier === "trial") return TRIAL_VOICE_ORGANIZE_CAP;
  return 0;
}

async function resolveTier(userId: string, tier?: SubscriptionTier) {
  return tier ?? getSubscriptionTier(userId);
}

async function getOrCreateRow(userId: string, monthKey = getMonthKey()) {
  const existing = await prisma.aiUsageMonthly.findUnique({
    where: { userId_monthKey: { userId, monthKey } },
  });
  if (existing) return existing;

  try {
    return await prisma.aiUsageMonthly.create({
      data: { userId, monthKey },
    });
  } catch {
    return prisma.aiUsageMonthly.findUniqueOrThrow({
      where: { userId_monthKey: { userId, monthKey } },
    });
  }
}

export async function getVoiceOrganizeUsage(userId: string): Promise<{
  units: number;
  monthKey: string;
}> {
  const monthKey = getMonthKey();
  const row = await prisma.aiUsageMonthly.findUnique({
    where: { userId_monthKey: { userId, monthKey } },
  });
  return { units: row?.voiceOrganizeUnits ?? 0, monthKey };
}

export async function canUseAiVoiceOrganize(
  userId: string,
  source: VoiceOrganizeSource,
  tier?: SubscriptionTier
): Promise<{ allowed: boolean; units: number; cap: number; weight: number }> {
  const resolvedTier = await resolveTier(userId, tier);
  const cap = voiceOrganizeCapForTier(resolvedTier);
  const weight = voiceOrganizeWeight(source);
  const { units } = await getVoiceOrganizeUsage(userId);

  if (cap === 0) {
    return { allowed: false, units, cap, weight };
  }

  return {
    allowed: units + weight <= cap,
    units,
    cap,
    weight,
  };
}

function usageToMicroUsd(usage: OpenAiUsage | null): number {
  if (!usage) return 0;
  return Math.round(estimateOpenAiCostUsd(usage.inputTokens, usage.outputTokens) * 1_000_000);
}

export async function recordAiUsage(
  userId: string,
  feature: AiUsageFeature,
  usage: OpenAiUsage | null,
  voiceWeight = 0
) {
  const monthKey = getMonthKey();
  const row = await getOrCreateRow(userId, monthKey);

  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const microUsd = usageToMicroUsd(usage);

  const data: Record<string, number> = {
    inputTokens: row.inputTokens + inputTokens,
    outputTokens: row.outputTokens + outputTokens,
    estimatedMicroUsd: row.estimatedMicroUsd + microUsd,
  };

  if (feature === "voice_organize" && voiceWeight > 0) {
    data.voiceOrganizeUnits = row.voiceOrganizeUnits + voiceWeight;
    data.voiceAiCalls = row.voiceAiCalls + 1;
  } else if (feature === "daily_briefing") {
    data.briefingCalls = row.briefingCalls + 1;
  } else if (feature === "evening_review") {
    data.eveningCalls = row.eveningCalls + 1;
  } else if (feature === "weekly_letter") {
    data.weeklyCalls = row.weeklyCalls + 1;
  }

  await prisma.aiUsageMonthly.update({
    where: { id: row.id },
    data,
  });
}

export async function getAiUsageSummary(userId: string): Promise<AiUsageSummary> {
  const tier = await getSubscriptionTier(userId);
  const monthKey = getMonthKey();
  const row = await getOrCreateRow(userId, monthKey);
  const cap = voiceOrganizeCapForTier(tier);
  const units = row.voiceOrganizeUnits;
  const remaining = Math.max(0, cap - units);

  return {
    monthKey,
    voiceOrganizeUnits: units,
    voiceOrganizeCap: cap,
    voiceOrganizeRemaining: remaining,
    atVoiceCap: cap > 0 && units >= cap,
    totalCalls: row.briefingCalls + row.eveningCalls + row.weeklyCalls + row.voiceAiCalls,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    estimatedUsd: row.estimatedMicroUsd / 1_000_000,
    byFeature: {
      voice_organize: row.voiceAiCalls,
      daily_briefing: row.briefingCalls,
      evening_review: row.eveningCalls,
      weekly_letter: row.weeklyCalls,
    },
  };
}

/** Night reflection already wrote evening review — skip duplicate OpenAI evening call */
export async function hasNightReflectionToday(userId: string): Promise<boolean> {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const night = await prisma.voiceCapture.findFirst({
    where: {
      userId,
      source: "night_reflection",
      createdAt: { gte: today, lt: tomorrow },
    },
  });
  return Boolean(night);
}

import { prisma } from "@forward/database";
import {
  computeLifeEngineStreakUpdate,
  getLifeEngineStreakStatus,
} from "@forward/ai";
import type { LifeEngineStreakPayload } from "@forward/shared";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Replenish one freeze on the first of each month (max 2 stored) */
async function maybeReplenishFreezes(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifeEngineFreezes: true, updatedAt: true },
  });
  if (!user) return;

  const monthStart = startOfMonth();
  if (user.updatedAt < monthStart && user.lifeEngineFreezes < 2) {
    await prisma.user.update({
      where: { id: userId },
      data: { lifeEngineFreezes: Math.min(2, user.lifeEngineFreezes + 1) },
    });
  }
}

export async function getLifeEngineStreak(userId: string): Promise<LifeEngineStreakPayload> {
  await maybeReplenishFreezes(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lifeEngineStreak: true,
      lifeEngineBestStreak: true,
      lifeEngineLastDone: true,
      lifeEngineFreezes: true,
    },
  });

  if (!user) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      freezesRemaining: 1,
      completedToday: false,
      atRisk: false,
      canUseFreeze: false,
    };
  }

  const status = getLifeEngineStreakStatus(
    user.lifeEngineLastDone,
    user.lifeEngineStreak,
    user.lifeEngineFreezes
  );

  return {
    currentStreak: user.lifeEngineStreak,
    bestStreak: user.lifeEngineBestStreak,
    freezesRemaining: user.lifeEngineFreezes,
    ...status,
  };
}

export async function recordLifeEngineCompletion(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lifeEngineStreak: true,
      lifeEngineBestStreak: true,
      lifeEngineLastDone: true,
    },
  });
  if (!user) return null;

  const update = computeLifeEngineStreakUpdate(
    user.lifeEngineLastDone,
    user.lifeEngineStreak,
    user.lifeEngineBestStreak
  );

  if (update.alreadyDoneToday) {
    return getLifeEngineStreak(userId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      lifeEngineStreak: update.streak,
      lifeEngineBestStreak: update.bestStreak,
      lifeEngineLastDone: update.lastCompletedAt,
    },
  });

  return getLifeEngineStreak(userId);
}

/** Use a streak freeze when yesterday was missed but streak is still recoverable */
export async function useLifeEngineFreeze(userId: string): Promise<LifeEngineStreakPayload | null> {
  const streak = await getLifeEngineStreak(userId);
  if (!streak.canUseFreeze) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifeEngineFreezes: true },
  });
  if (!user || user.lifeEngineFreezes <= 0) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0);

  await prisma.user.update({
    where: { id: userId },
    data: {
      lifeEngineLastDone: yesterday,
      lifeEngineFreezes: user.lifeEngineFreezes - 1,
    },
  });

  return getLifeEngineStreak(userId);
}

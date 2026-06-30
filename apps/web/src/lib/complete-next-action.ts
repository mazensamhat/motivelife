import { prisma } from "@forward/database";
import type { CompleteActionResult, DomainNextAction, LifeEngineStreakPayload } from "@forward/shared";
import { computeHabitCheckIn } from "@forward/ai";
import { recordProgressMoment } from "./forward";
import { recordLifeMoment } from "./life-moments";
import { awardLifeXp, xpAwardsForAction } from "./life-xp";
import { startOfDay } from "./api";
import type { DomainSlug } from "./domain-next-action";
import { getDomainNextAction } from "./domain-next-action";

const SLUG_TO_DOMAIN: Record<DomainSlug, string | null> = {
  career: "CAREER",
  money: "MONEY",
  health: "HEALTH",
  learning: "LEARNING",
  relationships: "RELATIONSHIPS",
  memory: "RELATIONSHIPS",
};

function parseHref(actionHref: string) {
  try {
    const url = new URL(actionHref, "https://motivelife.ai");
    const taskId = url.searchParams.get("focus");
    const hash = url.hash.replace("#", "");
    if (taskId) return { kind: "task" as const, id: taskId };
    if (hash.startsWith("app-")) return { kind: "application" as const, id: hash.slice(4) };
    if (hash.startsWith("item-")) return { kind: "item" as const, id: hash.slice(5) };
  } catch {
    /* ignore */
  }
  if (actionHref.includes("/habits")) return { kind: "habit" as const, id: null };
  if (actionHref.includes("/relationships")) return { kind: "relationships" as const, id: null };
  if (actionHref.includes("/memory")) return { kind: "memory" as const, id: null };
  return { kind: "generic" as const, id: null };
}

function estimateScoreGain(title: string, kind: string): number {
  if (/apply|resume|finished|offer/i.test(title)) return 8;
  if (/pay|save|debt/i.test(title)) return 5;
  if (/workout|walk|health|protein/i.test(title)) return 4;
  if (/call|message|family|mom/i.test(title)) return 6;
  if (kind === "task") return 4;
  return 3;
}

export async function completeDomainAction(
  userId: string,
  slug: DomainSlug,
  action: Pick<DomainNextAction, "title" | "actionHref" | "entityId">,
  options?: { lifeEngine?: boolean }
): Promise<CompleteActionResult> {
  const lifeDomain = SLUG_TO_DOMAIN[slug] as
    | "CAREER"
    | "MONEY"
    | "HEALTH"
    | "LEARNING"
    | "RELATIONSHIPS"
    | null;
  const parsed = parseHref(action.actionHref);
  const entityId = action.entityId ?? parsed.id;
  let timelineTitle = action.title;
  let scoreGain = estimateScoreGain(action.title, parsed.kind);
  let actionDomain: string | null = lifeDomain;

  if (parsed.kind === "task" && entityId) {
    const task = await prisma.task.findFirst({
      where: { id: entityId, userId },
      include: { goal: { select: { domain: true } } },
    });
    if (task && task.status !== "DONE") {
      await prisma.task.update({
        where: { id: entityId },
        data: { status: "DONE", completedAt: new Date() },
      });
      await recordProgressMoment(userId, task.title, "TASK_COMPLETED", task.goal?.domain ?? null);
      timelineTitle = task.title;
      actionDomain = task.goal?.domain ?? lifeDomain;
    }
  } else if (parsed.kind === "application" && entityId) {
    const app = await prisma.jobApplication.findFirst({ where: { id: entityId, userId } });
    if (app) {
      if (app.status === "SAVED") {
        await prisma.jobApplication.update({
          where: { id: entityId },
          data: { status: "APPLIED", appliedAt: new Date() },
        });
        timelineTitle = `Applied to ${app.company}`;
        scoreGain = 8;
      }
      await recordProgressMoment(userId, timelineTitle, "MILESTONE", "CAREER");
    }
  } else if (parsed.kind === "item" && entityId) {
    if (action.actionHref.includes("/money")) {
      const item = await prisma.moneyItem.findFirst({ where: { id: entityId, userId } });
      if (item) {
        if (item.type === "BILL") {
          timelineTitle = `Paid ${item.title}`;
          await recordProgressMoment(userId, timelineTitle, "MILESTONE", "MONEY");
        } else if (item.type === "SAVINGS" && item.targetAmount) {
          const bump = Math.max(50, Math.round((item.targetAmount - item.currentAmount) * 0.05));
          await prisma.moneyItem.update({
            where: { id: entityId },
            data: { currentAmount: Math.min(item.targetAmount, item.currentAmount + bump) },
          });
          timelineTitle = `Saved toward ${item.title}`;
          await recordProgressMoment(userId, timelineTitle, "MILESTONE", "MONEY");
        } else if (item.type === "DEBT" && item.currentAmount > 0) {
          const payment = Math.min(item.currentAmount, Math.max(25, item.currentAmount * 0.1));
          await prisma.moneyItem.update({
            where: { id: entityId },
            data: { currentAmount: item.currentAmount - payment },
          });
          timelineTitle = `Payment toward ${item.title}`;
          await recordProgressMoment(userId, timelineTitle, "MILESTONE", "MONEY");
        }
      }
    } else if (action.actionHref.includes("/health")) {
      const item = await prisma.healthItem.findFirst({ where: { id: entityId, userId } });
      if (item && item.targetValue) {
        const bump = Math.max(1, Math.round(item.targetValue * 0.1));
        await prisma.healthItem.update({
          where: { id: entityId },
          data: { currentValue: Math.min(item.targetValue, item.currentValue + bump) },
        });
        timelineTitle = `Progress on ${item.title}`;
        await recordProgressMoment(userId, timelineTitle, "MILESTONE", "HEALTH");
      }
    } else if (action.actionHref.includes("/learning")) {
      const item = await prisma.learningItem.findFirst({ where: { id: entityId, userId } });
      if (item) {
        const next = Math.min(100, item.progress + 10);
        await prisma.learningItem.update({
          where: { id: entityId },
          data: { progress: next },
        });
        timelineTitle = `Studied: ${item.title}`;
        await recordProgressMoment(userId, timelineTitle, "MILESTONE", "LEARNING");
      }
    }
  } else if (parsed.kind === "habit" || (entityId && action.actionHref.includes("/habits"))) {
    const habit = entityId
      ? await prisma.habit.findFirst({ where: { id: entityId, userId, active: true } })
      : await prisma.habit.findFirst({ where: { userId, active: true }, orderBy: { streak: "desc" } });
    if (habit) {
      const result = computeHabitCheckIn(
        habit.lastDoneAt,
        habit.frequency as "DAILY" | "WEEKLY",
        habit.streak,
        habit.bestStreak
      );
      if (!result.alreadyDone) {
        await prisma.habit.update({
          where: { id: habit.id },
          data: {
            streak: result.streak,
            bestStreak: result.bestStreak,
            lastDoneAt: result.lastDoneAt,
            updatedAt: new Date(),
          },
        });
      }
      timelineTitle = habit.title;
      await recordProgressMoment(userId, `Checked in: ${habit.title}`, "MILESTONE", null);
    }
  } else if (
    parsed.kind === "memory" ||
    parsed.kind === "relationships" ||
    slug === "memory" ||
    slug === "relationships"
  ) {
    if (entityId) {
      const habit = await prisma.habit.findFirst({ where: { id: entityId, userId } });
      if (habit) {
        const result = computeHabitCheckIn(
          habit.lastDoneAt,
          habit.frequency as "DAILY" | "WEEKLY",
          habit.streak,
          habit.bestStreak
        );
        if (!result.alreadyDone) {
          await prisma.habit.update({
            where: { id: habit.id },
            data: {
              streak: result.streak,
              bestStreak: result.bestStreak,
              lastDoneAt: result.lastDoneAt,
            },
          });
        }
      }
    }
    timelineTitle = action.title;
    await recordProgressMoment(userId, timelineTitle, "MILESTONE", "RELATIONSHIPS");
    scoreGain = 6;
  } else {
    await recordProgressMoment(
      userId,
      action.title,
      "MILESTONE",
      lifeDomain ?? undefined
    );
  }

  await prisma.dailyScoreSnapshot.deleteMany({
    where: { userId, date: { gte: startOfDay() } },
  });

  await recordLifeMoment(userId, {
    title: timelineTitle,
    domain: lifeDomain ?? undefined,
    scoreDelta: scoreGain,
    sourceType: parsed.kind === "task" ? "TASK" : "ACTION",
    sourceId: entityId ?? undefined,
  });

  let lifeEngineStreak: LifeEngineStreakPayload | undefined;
  if (options?.lifeEngine) {
    const { getLifeEngineStreak, recordLifeEngineCompletion } = await import("./life-engine-streak");
    const before = await getLifeEngineStreak(userId);
    const streak = await recordLifeEngineCompletion(userId);
    if (streak) {
      lifeEngineStreak = streak;
      if (!before.completedToday && streak.completedToday) {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        const { notifyCircleOwnersLifeEngine } = await import("./notifications");
        await notifyCircleOwnersLifeEngine(
          userId,
          actor?.name ?? "Friend",
          streak.currentStreak
        );
      }
    }
  }

  const xpAwards = xpAwardsForAction({
    domain: actionDomain,
    title: timelineTitle,
    lifeEngine: options?.lifeEngine,
  }).map((a) => ({ ...a, sourceType: parsed.kind, sourceId: entityId ?? undefined }));
  const xpGains = await awardLifeXp(userId, xpAwards);

  return {
    scoreGain,
    message: `+${scoreGain} Motive Life Score`,
    timelineTitle,
    lifeEngineStreak,
    xpGains,
  };
}

export async function completeAndRefresh(
  userId: string,
  slug: DomainSlug,
  action: Pick<DomainNextAction, "title" | "actionHref" | "entityId">,
  options?: { lifeEngine?: boolean }
) {
  const result = await completeDomainAction(userId, slug, action, options);
  const nextAction = await getDomainNextAction(userId, slug);
  return { ...result, nextAction };
}

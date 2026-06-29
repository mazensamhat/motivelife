import { prisma } from "@forward/database";
import type { DomainScoreMap } from "@forward/shared";
import { startOfDay } from "./api";

function clamp(n: number, min = 40, max = 99) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function avgProgress(items: { progress?: number; currentValue?: number; targetValue?: number | null }[]) {
  if (items.length === 0) return 55;
  const values = items.map((i) => {
    if (typeof i.progress === "number") return i.progress;
    if (i.targetValue && i.targetValue > 0 && i.currentValue != null) {
      return Math.min(100, (i.currentValue / i.targetValue) * 100);
    }
    return 50;
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function computeDomainScores(userId: string): Promise<DomainScoreMap> {
  const today = startOfDay();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [
    careerGoals,
    moneyGoals,
    healthGoals,
    learningGoals,
    relGoals,
    moneyItems,
    healthItems,
    learningItems,
    relationshipItems,
    habits,
    applications,
    completedToday,
    yesterdaySnap,
  ] = await Promise.all([
    prisma.goal.findMany({ where: { userId, domain: "CAREER", status: "ACTIVE" } }),
    prisma.goal.findMany({ where: { userId, domain: "MONEY", status: "ACTIVE" } }),
    prisma.goal.findMany({ where: { userId, domain: "HEALTH", status: "ACTIVE" } }),
    prisma.goal.findMany({ where: { userId, domain: "LEARNING", status: "ACTIVE" } }),
    prisma.goal.findMany({ where: { userId, domain: "RELATIONSHIPS", status: "ACTIVE" } }),
    prisma.moneyItem.findMany({ where: { userId } }),
    prisma.healthItem.findMany({ where: { userId } }),
    prisma.learningItem.findMany({ where: { userId } }),
    prisma.relationshipItem.findMany({ where: { userId } }),
    prisma.habit.findMany({ where: { userId, active: true } }),
    prisma.jobApplication.findMany({
      where: { userId, status: { notIn: ["REJECTED", "WITHDRAWN"] } },
    }),
    prisma.task.count({
      where: { userId, status: "DONE", completedAt: { gte: today } },
    }),
    prisma.dailyScoreSnapshot.findUnique({
      where: { userId_date: { userId, date: yesterday } },
    }).catch(() => null),
  ]);

  const fitnessHabits = habits.filter((h) =>
    /workout|walk|run|gym|exercise|steps/i.test(h.title)
  );
  const mindsetHabits = habits.filter((h) =>
    /meditat|journal|sleep|stress|mindful/i.test(h.title)
  );

  const career =
    careerGoals.length > 0
      ? clamp(avgProgress(careerGoals) + Math.min(15, applications.length * 3))
      : clamp(50 + applications.length * 5);

  const moneyProgress = moneyItems.map((m) => ({
    currentValue: m.currentAmount,
    targetValue: m.targetAmount,
  }));
  const money =
    moneyItems.length > 0 ? clamp(avgProgress(moneyProgress)) : clamp(55);

  const healthFitness = healthItems.filter((h) => h.type === "FITNESS" || h.type === "SLEEP");
  const health =
    healthItems.length > 0 || fitnessHabits.length > 0
      ? clamp(
          (avgProgress(healthFitness.length ? healthFitness : healthItems) +
            Math.min(20, fitnessHabits.reduce((s, h) => s + h.streak, 0))) /
            2
        )
      : clamp(55 + fitnessHabits.reduce((s, h) => s + Math.min(h.streak, 5), 0));

  const learning =
    learningItems.length > 0
      ? clamp(avgProgress(learningItems))
      : clamp(50 + learningGoals.length * 8);

  const relationships =
    relationshipItems.length > 0
      ? clamp(
          relationshipItems.reduce((sum, item) => {
            if (!item.cadenceDays) return sum + 65;
            if (!item.lastContactAt) return sum + 45;
            const days = (Date.now() - item.lastContactAt.getTime()) / 86400000;
            if (days <= item.cadenceDays) return sum + Math.min(100, 75 + ((item.cadenceDays - days) / item.cadenceDays) * 25);
            return sum + Math.max(40, 70 - (days - item.cadenceDays) * 4);
          }, 0) / relationshipItems.length
        )
      : relGoals.length > 0
        ? clamp(avgProgress(relGoals))
        : clamp(58);

  const mindset =
    mindsetHabits.length > 0
      ? clamp(55 + mindsetHabits.reduce((s, h) => s + Math.min(h.streak * 2, 20), 0))
      : clamp(56);

  const overall = clamp(
    (career + money + health + learning + relationships + mindset) / 6
  );

  let overallDelta = 0;
  const domainDeltas = {
    career: 0,
    money: 0,
    health: 0,
    learning: 0,
    relationships: 0,
    mindset: 0,
  };

  if (yesterdaySnap) {
    try {
      const prev = JSON.parse(yesterdaySnap.scores) as DomainScoreMap;
      overallDelta = overall - (prev.overall ?? overall);
      domainDeltas.career = career - (prev.career ?? career);
      domainDeltas.money = money - (prev.money ?? money);
      domainDeltas.health = health - (prev.health ?? health);
      domainDeltas.learning = learning - (prev.learning ?? learning);
      domainDeltas.relationships = relationships - (prev.relationships ?? relationships);
      domainDeltas.mindset = mindset - (prev.mindset ?? mindset);
    } catch {
      overallDelta = Math.min(5, completedToday);
    }
  } else {
    overallDelta = Math.min(5, completedToday > 0 ? 1 + completedToday : 0);
  }

  return {
    career,
    money,
    health,
    learning,
    relationships,
    mindset,
    overall,
    overallDelta,
    domainDeltas,
  };
}

export async function saveDailyScoreSnapshot(userId: string, scores: DomainScoreMap) {
  const today = startOfDay();
  await prisma.dailyScoreSnapshot.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, scores: JSON.stringify(scores) },
    update: { scores: JSON.stringify(scores) },
  });
}

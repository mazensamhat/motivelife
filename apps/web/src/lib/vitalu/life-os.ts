import type { KashuLifeOsInsight } from "@forward/shared";
import { groceryWeeklyEstimate } from "@forward/shared";
import { prisma } from "@forward/database";
import { upsertHealthMetrics } from "@/lib/health-sync";
import { assembleVitaluWorkout } from "@/lib/vitalu/workout-engine";
import { runKashuWhatIf, type KashuMoneyRow, type KashuProfileRow } from "@/lib/kashu/forecast";
import { loadVitaluToday } from "@/lib/vitalu/load";

const MOVEMENT_HABIT_RE = /workout|walk|run|gym|exercise|steps|yoga|mobility/i;
const WALK_HABIT_RE = /walk|steps|run|jog/i;
const WEIGHT_GOAL_RE = /weight|lose|kg|lb|pound|kilo/i;
const WORKOUT_GOAL_RE = /workout|gym|fitness|exercise|active|strength|train/i;
const KINZO_WALK_RE = /walk|on foot|stroll|park/i;
const KINZO_GYM_RE = /gym|workout|fitness|yoga|studio/i;

const kinzoSyncAt = new Map<string, number>();
const KINZO_SYNC_MS = 2 * 60_000;

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** UPLIFT owns the goal; Vitalu writes execution progress onto HEALTH goals. */
export async function syncUpliftHealthGoals(userId: string): Promise<void> {
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!profile?.planIntent) return;

  const goals = await prisma.goal.findMany({
    where: { userId, domain: "HEALTH", status: "ACTIVE" },
    take: 12,
  });
  if (!goals.length) return;

  const firstWeight = await prisma.vitaluWeightLog.findFirst({
    where: { userId },
    orderBy: { recordedAt: "asc" },
  });
  const since7 = startOfDay();
  since7.setDate(since7.getDate() - 7);
  const workoutsDone = await prisma.vitaluWorkout.count({
    where: { userId, completedAt: { gte: since7 } },
  });

  for (const goal of goals) {
    let progress: number | null = null;
    if (WEIGHT_GOAL_RE.test(goal.title) && profile.goalWeightKg != null && profile.currentWeightKg != null) {
      const start = firstWeight?.kg ?? profile.currentWeightKg;
      const target = profile.goalWeightKg;
      const current = profile.currentWeightKg;
      const span = start - target;
      if (Math.abs(span) >= 0.3) {
        progress = Math.round(Math.min(100, Math.max(0, ((start - current) / span) * 100)));
      }
    } else if (WORKOUT_GOAL_RE.test(goal.title) && profile.workoutsPerWeek) {
      progress = Math.round(Math.min(100, (workoutsDone / Math.max(1, profile.workoutsPerWeek)) * 100));
    }
    if (progress != null && progress !== goal.progress) {
      await prisma.goal.update({ where: { id: goal.id }, data: { progress } });
    }
  }
}

export async function syncHabitToVitalu(userId: string, title: string): Promise<void> {
  if (!MOVEMENT_HABIT_RE.test(title)) return;
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!profile?.planIntent) return;

  const today = startOfDay();
  if (WALK_HABIT_RE.test(title)) {
    const existing = await prisma.healthMetric.findFirst({
      where: {
        userId,
        source: "habit",
        metricType: "steps",
        periodStart: { gte: today },
      },
    });
    const next = Math.min(profile.stepsTarget ?? 8000, (existing?.value ?? 0) + 2500);
    await upsertHealthMetrics(userId, [
      {
        source: "habit",
        metricType: "steps",
        value: next,
        unit: "steps",
        periodStart: today.toISOString(),
      },
    ]);
    return;
  }

  const open = await prisma.vitaluWorkout.findFirst({
    where: { userId, plannedFor: { gte: today }, completedAt: null },
    orderBy: { plannedFor: "desc" },
  });
  if (open) {
    await prisma.vitaluWorkout.update({
      where: { id: open.id },
      data: { completedAt: new Date() },
    });
    return;
  }
  const already = await prisma.vitaluWorkout.findFirst({
    where: { userId, plannedFor: { gte: today }, completedAt: { not: null } },
  });
  if (already) return;

  const session = assembleVitaluWorkout({
    minutes: 20,
    equipment: "NONE",
    lastFeedback: (profile.lastWorkoutFeedback as "TOO_EASY" | "PERFECT" | "TOO_HARD" | null) ?? null,
  });
  await prisma.vitaluWorkout.create({
    data: {
      userId,
      title: session.title,
      minutes: session.minutes,
      equipment: session.equipment,
      sessionJson: JSON.stringify(session),
      completedAt: new Date(),
    },
  });
}

export async function syncWorkoutToHabits(userId: string): Promise<void> {
  const habits = await prisma.habit.findMany({
    where: { userId, active: true },
    take: 40,
  });
  const match = habits.find((h) => MOVEMENT_HABIT_RE.test(h.title) && !WALK_HABIT_RE.test(h.title));
  if (!match) return;
  const last = match.lastDoneAt;
  const today = startOfDay();
  if (last && last >= today) return;
  await prisma.habit.update({
    where: { id: match.id },
    data: {
      lastDoneAt: new Date(),
      streak: (match.streak ?? 0) + 1,
      bestStreak: Math.max(match.bestStreak ?? 0, (match.streak ?? 0) + 1),
    },
  });
}

/** Permissioned KINZO walking/gym presence → Vitalu movement. Not a wearable sync. */
export async function syncKinzoMovementToVitalu(userId: string): Promise<void> {
  const last = kinzoSyncAt.get(userId) ?? 0;
  if (Date.now() - last < KINZO_SYNC_MS) return;
  kinzoSyncAt.set(userId, Date.now());

  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!profile?.planIntent) return;

  const member = await prisma.familyMember.findFirst({
    where: { userId, shareDigitalTwinIntegration: true, isSimulated: false },
    select: {
      statusLabel: true,
      presenceStatus: true,
      lastSpeedKmh: true,
      lastLocationAt: true,
    },
  });
  if (!member?.lastLocationAt) return;
  const today = startOfDay();
  if (member.lastLocationAt < today) return;

  const label = `${member.statusLabel ?? ""} ${member.presenceStatus ?? ""}`.toLowerCase();
  const walking =
    KINZO_WALK_RE.test(label) ||
    (member.presenceStatus === "moving" && (member.lastSpeedKmh ?? 0) > 2 && (member.lastSpeedKmh ?? 0) < 9);

  if (walking) {
    const existing = await prisma.healthMetric.findFirst({
      where: { userId, source: "kinzo", metricType: "steps", periodStart: { gte: today } },
    });
    if (existing) return;
    await upsertHealthMetrics(userId, [
      {
        source: "kinzo",
        metricType: "steps",
        value: 3000,
        unit: "steps",
        periodStart: today.toISOString(),
      },
    ]);
    return;
  }

  if (!KINZO_GYM_RE.test(label)) return;
  const done = await prisma.vitaluWorkout.findFirst({
    where: { userId, plannedFor: { gte: today }, completedAt: { not: null } },
  });
  if (done) return;
  const open = await prisma.vitaluWorkout.findFirst({
    where: { userId, plannedFor: { gte: today }, completedAt: null },
  });
  if (open) {
    await prisma.vitaluWorkout.update({
      where: { id: open.id },
      data: { completedAt: new Date() },
    });
    return;
  }
  const session = assembleVitaluWorkout({ minutes: 30, equipment: "GYM" });
  await prisma.vitaluWorkout.create({
    data: {
      userId,
      title: session.title,
      minutes: session.minutes,
      equipment: session.equipment,
      sessionJson: JSON.stringify(session),
      completedAt: new Date(),
    },
  });
}

export async function noteKinzoPlaceForVitalu(
  userId: string,
  toLabel: string | null,
  durationMinutes: number
): Promise<void> {
  const label = toLabel ?? "";
  if (!KINZO_WALK_RE.test(label) && !KINZO_GYM_RE.test(label)) return;
  if (durationMinutes < 8) return;
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!profile?.planIntent) return;
  const today = startOfDay();
  if (KINZO_WALK_RE.test(label)) {
    await upsertHealthMetrics(userId, [
      {
        source: "kinzo",
        metricType: "active_minutes",
        value: Math.min(90, durationMinutes),
        unit: "min",
        periodStart: today.toISOString(),
      },
    ]);
    return;
  }
  kinzoSyncAt.delete(userId);
  await syncKinzoMovementToVitalu(userId);
}

export async function collectVitaluKashuInsights(
  userId: string,
  profile: KashuProfileRow,
  items: KashuMoneyRow[]
): Promise<KashuLifeOsInsight[]> {
  const health = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!health?.planIntent || !health.calorieTarget) return [];

  const insights: KashuLifeOsInsight[] = [];
  const weekly = groceryWeeklyEstimate(health.calorieTarget, health.proteinTargetG);
  insights.push({
    id: "vitalu-groceries",
    source: "vitalu",
    title: "Meal-plan groceries (estimate)",
    detail: `Vitalu’s calorie/protein targets imply about ${money(weekly)}/week in groceries — a wellness estimate, not a shop. Money stays in Kashu.`,
    href: "/vitalu",
    extraWeekly: weekly,
  });

  const gymOriented =
    health.workoutsPerWeek != null &&
    health.workoutsPerWeek >= 3 &&
    /BUILD_MUSCLE|IMPROVE_FITNESS|GET_MORE_ACTIVE/.test(health.planIntent);
  if (gymOriented) {
    const whatIf = runKashuWhatIf(profile, items, {
      newMonthlyBill: { title: "Gym membership", amount: 50, dueDay: 1 },
    });
    insights.push({
      id: "vitalu-gym",
      source: "vitalu",
      title: "Gym membership vs plan",
      detail: `Vitalu: a gym supports this fitness plan. Kashu: ${whatIf.verdictLabel}. Fitness value stays in Vitalu; cash-flow stays in Kashu.`,
      href: "/kashu",
      extraMonthly: 50,
      verdict: whatIf.verdict,
      verdictLabel: whatIf.verdictLabel,
    });
  }

  return insights;
}

export async function applyVoiceHealthToVitalu(
  userId: string,
  note: { title: string; value?: number | null; unit?: string | null; notes?: string | null }
): Promise<{ label: string; entityId: string; href: string }> {
  const title = note.title;
  const unit = (note.unit ?? "").toLowerCase();
  const today = startOfDay();

  if (/sleep/i.test(title) || unit === "hours" || unit === "hour") {
    const hours = note.value != null && note.value > 0 && note.value < 16 ? note.value : 7;
    await upsertHealthMetrics(userId, [
      {
        source: "voice",
        metricType: "sleep_minutes",
        value: Math.round(hours * 60),
        unit: "min",
        periodStart: today.toISOString(),
      },
    ]);
    return { label: `Vitalu: sleep ${hours}h logged`, entityId: "sleep", href: "/vitalu" };
  }

  if (/weight|weigh|kg|lb|pound/i.test(title) || unit === "kg" || unit === "lb") {
    let kg = note.value ?? null;
    if (kg != null) {
      if (unit === "lb" || kg > 180) kg = Math.round((kg / 2.20462) * 10) / 10;
      if (kg >= 30 && kg <= 400) {
        await prisma.vitaluWeightLog.create({
          data: { userId, kg, source: "VOICE" },
        });
        await prisma.healthProfile.upsert({
          where: { userId },
          create: { userId, units: "METRIC", currentWeightKg: kg },
          update: { currentWeightKg: kg },
        });
        await syncUpliftHealthGoals(userId).catch(() => undefined);
        return { label: `Vitalu: weight ${kg} kg logged`, entityId: "weight", href: "/vitalu" };
      }
    }
  }

  if (MOVEMENT_HABIT_RE.test(title)) {
    await syncHabitToVitalu(userId, title);
    return { label: `Vitalu: ${title.slice(0, 80)}`, entityId: "workout", href: "/vitalu" };
  }

  await prisma.healthProfile.upsert({
    where: { userId },
    create: { userId, units: "METRIC" },
    update: {},
  });
  return { label: `Vitalu note: ${title.slice(0, 80)}`, entityId: "note", href: "/vitalu" };
}

export async function syncVitaluLifeOsQuietly(userId: string): Promise<void> {
  await Promise.allSettled([syncKinzoMovementToVitalu(userId), syncUpliftHealthGoals(userId)]);
}

/** Used by Life Graph / scores — derived only, never raw meals. */
export async function loadVitaluDerivedForVault(userId: string) {
  const today = await loadVitaluToday(userId);
  if (!today.profile.vaultShareLifeGraph) return null;
  return {
    vitalScore: today.score.total,
    healthTrend: today.healthTrend,
    nextAction: today.derived.nextAction,
    workoutsCompletedThisWeek: today.workoutsCompletedThisWeek,
    workoutsPerWeek: today.profile.workoutsPerWeek,
    sleepHours: today.sleepHoursLastNight,
    setupComplete: today.setupComplete,
  };
}

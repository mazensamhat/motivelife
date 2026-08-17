import { prisma } from "@forward/database";
import type {
  VitaluActivityLevel,
  VitaluDerivedInsight,
  VitaluFoodLogRow,
  VitaluMealSlot,
  VitaluNutritionToday,
  VitaluPlanIntent,
  VitaluProfileFields,
  VitaluScore,
  VitaluSex,
  VitaluUnits,
  VitaluWeightTrend,
  VitaluWorkoutFeedback,
  VitaluWorkoutRow,
  VitaluWorkoutSession,
} from "@forward/shared";
import { buildVitaluScore } from "@/lib/vitalu/vital-score";
import { informationalBmi } from "@/lib/vitalu/plan-targets";
import { loadVitaluFoodMemory } from "@/lib/vitalu/food-memory";
import { isCalendarPackedToday, toVitaluDerivedInsight } from "@/lib/vitalu/derived";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
}

export async function getOrCreateHealthProfile(userId: string) {
  const existing = await prisma.healthProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.healthProfile.create({
    data: { userId, units: "METRIC" },
  });
}

export function toVitaluProfileFields(row: {
  biologicalSex: string | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  activityLevel: string | null;
  planIntent: string | null;
  units: string;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  waterTargetMl: number | null;
  stepsTarget: number | null;
  workoutsPerWeek: number | null;
  vaultShareLifeGraph: boolean;
  vaultShareVyra: boolean;
  lastWorkoutFeedback?: string | null;
}): VitaluProfileFields {
  return {
    biologicalSex: (row.biologicalSex as VitaluSex | null) ?? null,
    heightCm: row.heightCm,
    currentWeightKg: row.currentWeightKg,
    goalWeightKg: row.goalWeightKg,
    activityLevel: (row.activityLevel as VitaluActivityLevel | null) ?? null,
    planIntent: (row.planIntent as VitaluPlanIntent | null) ?? null,
    units: (row.units as VitaluUnits) || "METRIC",
    calorieTarget: row.calorieTarget,
    proteinTargetG: row.proteinTargetG,
    carbsTargetG: row.carbsTargetG,
    fatTargetG: row.fatTargetG,
    waterTargetMl: row.waterTargetMl,
    stepsTarget: row.stepsTarget,
    workoutsPerWeek: row.workoutsPerWeek,
    vaultShareLifeGraph: row.vaultShareLifeGraph,
    vaultShareVyra: row.vaultShareVyra,
    lastWorkoutFeedback: (row.lastWorkoutFeedback as VitaluWorkoutFeedback | null) ?? null,
  };
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

export async function loadVitaluToday(userId: string) {
  const profile = await getOrCreateHealthProfile(userId);
  const fields = toVitaluProfileFields(profile);

  const since30 = daysAgo(30);
  const since7 = daysAgo(7);
  const today = startOfDay();

  const [weightLogs, metrics, user, foodLogs, workouts, foodMemory, calendarPacked] = await Promise.all([
    prisma.vitaluWeightLog.findMany({
      where: { userId, recordedAt: { gte: since30 } },
      orderBy: { recordedAt: "desc" },
      take: 60,
    }),
    prisma.healthMetric.findMany({
      where: { userId, periodStart: { gte: since7 } },
      orderBy: { periodStart: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { birthYear: true },
    }),
    prisma.vitaluFoodLog.findMany({
      where: { userId, eatenAt: { gte: today } },
      orderBy: { eatenAt: "desc" },
    }),
    prisma.vitaluWorkout.findMany({
      where: { userId, plannedFor: { gte: daysAgo(7) } },
      orderBy: { plannedFor: "desc" },
      take: 14,
    }),
    loadVitaluFoodMemory(userId),
    isCalendarPackedToday(userId),
  ]);

  const todayMetrics = metrics.filter((m) => m.periodStart >= today);
  const stepsToday = todayMetrics.find((m) => m.metricType === "steps")?.value ?? null;
  const sleepMinutes =
    todayMetrics.find((m) => m.metricType === "sleep_minutes")?.value ??
    metrics.find((m) => m.metricType === "sleep_minutes")?.value ??
    null;

  const days = new Set<string>();
  for (const m of metrics) days.add(m.periodStart.toISOString().slice(0, 10));
  for (const w of weightLogs) {
    if (w.recordedAt >= since7) days.add(w.recordedAt.toISOString().slice(0, 10));
  }
  for (const f of foodLogs) days.add(f.eatenAt.toISOString().slice(0, 10));
  for (const w of workouts) {
    if (w.completedAt) days.add(w.completedAt.toISOString().slice(0, 10));
  }

  const nutritionLogs: VitaluFoodLogRow[] = foodLogs.map((f) => ({
    logId: f.id,
    id: f.catalogId ?? f.id,
    name: f.title,
    servingLabel: `${Math.round(f.grams)} g`,
    grams: f.grams,
    kcal: f.kcal,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    fiberG: f.fiberG,
    waterMl: f.waterMl,
    mealSlot: (f.mealSlot as VitaluMealSlot) || "SNACK",
    eatenAt: f.eatenAt.toISOString(),
  }));
  const kcal = nutritionLogs.reduce((s, l) => s + l.kcal, 0);
  const proteinG = nutritionLogs.reduce((s, l) => s + l.proteinG, 0);
  const carbsG = nutritionLogs.reduce((s, l) => s + l.carbsG, 0);
  const fatG = nutritionLogs.reduce((s, l) => s + l.fatG, 0);
  const fiberG = nutritionLogs.reduce((s, l) => s + l.fiberG, 0);
  const waterMl = nutritionLogs.reduce((s, l) => s + l.waterMl, 0);
  const hasFood = nutritionLogs.length > 0;
  const nutrition: VitaluNutritionToday = {
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    waterMl,
    remainingKcal: fields.calorieTarget != null ? Math.round(fields.calorieTarget - kcal) : null,
    remainingProteinG: fields.proteinTargetG != null ? Math.round(fields.proteinTargetG - proteinG) : null,
    remainingWaterMl: fields.waterTargetMl != null ? Math.round(fields.waterTargetMl - waterMl) : null,
    logs: nutritionLogs,
  };

  const workoutsCompletedThisWeek = workouts.filter(
    (w) => w.completedAt && w.completedAt >= since7
  ).length;

  const score: VitaluScore = buildVitaluScore({
    caloriesConsumed: hasFood ? kcal : null,
    calorieTarget: fields.calorieTarget,
    proteinConsumedG: hasFood ? proteinG : null,
    proteinTargetG: fields.proteinTargetG,
    stepsToday,
    stepsTarget: fields.stepsTarget,
    workoutsCompletedThisWeek,
    workoutsPerWeek: fields.workoutsPerWeek,
    sleepHoursLastNight: sleepMinutes != null ? sleepMinutes / 60 : null,
    daysWithSignalLast7: days.size || null,
  });

  const recent = weightLogs.filter((w) => w.recordedAt >= since7).map((w) => w.kg);
  const older = weightLogs.filter((w) => w.recordedAt < since7).map((w) => w.kg);
  const weight: VitaluWeightTrend = {
    todayKg: weightLogs[0]?.kg ?? fields.currentWeightKg,
    average7dKg: avg(recent.length ? recent : weightLogs.slice(0, 7).map((w) => w.kg)),
    change30dKg:
      avg(recent) != null && avg(older) != null ? (avg(recent) as number) - (avg(older) as number) : null,
    goalKg: fields.goalWeightKg,
  };

  const bmi =
    fields.currentWeightKg && fields.heightCm
      ? informationalBmi(fields.currentWeightKg, fields.heightCm)
      : null;

  const setupComplete = Boolean(fields.planIntent && fields.calorieTarget);
  const sleepHours = sleepMinutes != null ? Math.round((sleepMinutes / 60) * 10) / 10 : null;
  const recoveryRecommended = sleepHours != null && sleepHours < 6;

  const todayWorkoutRow = workouts.find((w) => w.plannedFor >= today) ?? null;
  let todayWorkout: VitaluWorkoutRow | null = null;
  if (todayWorkoutRow) {
    try {
      todayWorkout = {
        id: todayWorkoutRow.id,
        plannedFor: todayWorkoutRow.plannedFor.toISOString(),
        completedAt: todayWorkoutRow.completedAt?.toISOString() ?? null,
        feedback: (todayWorkoutRow.feedback as VitaluWorkoutFeedback | null) ?? null,
        session: JSON.parse(todayWorkoutRow.sessionJson) as VitaluWorkoutSession,
      };
    } catch {
      todayWorkout = null;
    }
  }

  const healthTrend: "Improving" | "Steady" | "Slipping" | "Unknown" =
    score.total == null
      ? "Unknown"
      : score.total >= 70
        ? "Improving"
        : score.total >= 50
          ? "Steady"
          : "Slipping";

  const derived: VitaluDerivedInsight = toVitaluDerivedInsight({
    profile: fields,
    score,
    nutrition,
    sleepHours,
    stepsToday,
    recoveryRecommended,
    healthTrend,
    workoutsCompletedThisWeek,
    calendarPacked,
    setupComplete,
    hasWorkoutToday: Boolean(todayWorkout),
  });

  return {
    profile: fields,
    birthYear: user?.birthYear ?? null,
    score,
    weight,
    nutrition,
    foodMemory,
    todayWorkout,
    stepsToday,
    sleepHoursLastNight: sleepHours,
    informationalBmi: bmi,
    setupComplete,
    recoveryRecommended,
    healthTrend,
    workoutsCompletedThisWeek,
    calendarPacked,
    derived,
  };
}

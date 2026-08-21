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
import {
  mergeDailyHealthMetrics,
  mergeLastNightSleepMinutes,
  type HealthMetricRow,
  type MergedDailyHealth,
} from "@/lib/health-correlation";
import { civilDayKey, startOfCivilDay } from "@/lib/health-civil-day";
import { maybeSyncStaleFitbit } from "@/lib/fitbit";

function startOfDay(d = new Date()) {
  return startOfCivilDay(d);
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
  await maybeSyncStaleFitbit(userId);

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

  const metricRows: HealthMetricRow[] = metrics.map((m) => ({
    source: m.source,
    metricType: m.metricType,
    value: m.value,
    unit: m.unit,
    periodStart: m.periodStart,
    createdAt: m.createdAt,
  }));

  const mergedToday: MergedDailyHealth = mergeDailyHealthMetrics(metricRows, today);
  const lastNight = mergeLastNightSleepMinutes(metricRows);
  const sleepMerged = lastNight.merged;

  const stepsToday = mergedToday.steps?.value ?? null;
  const activeMinutesToday = mergedToday.activeMinutes?.value ?? null;
  const restingHr = mergedToday.restingHr?.value ?? null;
  const heartRateAvg = mergedToday.heartRate?.value ?? null;
  const sleepingBodyTempC = mergedToday.sleepingBodyTempC?.value ?? null;
  const sleepMinutes = sleepMerged?.value ?? null;

  // Personal overnight temp baseline = mean of last 14 days with readings (excluding today).
  let sleepingBodyTempBaselineC: number | null = null;
  {
    const temps: number[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const t = mergeDailyHealthMetrics(metricRows, d).sleepingBodyTempC?.value;
      if (t != null) temps.push(t);
    }
    if (temps.length >= 3) {
      sleepingBodyTempBaselineC =
        Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 100) / 100;
    }
  }

  const days = new Set<string>();
  for (const m of metrics) days.add(civilDayKey(m.periodStart));
  for (const w of weightLogs) {
    if (w.recordedAt >= since7) days.add(civilDayKey(w.recordedAt));
  }
  for (const f of foodLogs) days.add(civilDayKey(f.eatenAt));
  for (const w of workouts) {
    if (w.completedAt) days.add(civilDayKey(w.completedAt));
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
    activeMinutesToday,
    workoutsCompletedThisWeek,
    workoutsPerWeek: fields.workoutsPerWeek,
    sleepHoursLastNight: sleepMinutes != null ? sleepMinutes / 60 : null,
    restingHr,
    sleepingBodyTempC,
    sleepingBodyTempBaselineC,
    daysWithSignalLast7: days.size || null,
    priorTotal: null, // Week-over-week prior total wired when we persist daily score history.
  });

  const since14 = daysAgo(14);
  const recent7 = weightLogs.filter((w) => w.recordedAt >= since7).map((w) => w.kg);
  const prior7 = weightLogs.filter((w) => w.recordedAt >= since14 && w.recordedAt < since7).map((w) => w.kg);
  const older30 = weightLogs.filter((w) => w.recordedAt < since7 && w.recordedAt >= since30).map((w) => w.kg);
  const avgRecent7 = avg(recent7.length ? recent7 : weightLogs.slice(0, 7).map((w) => w.kg));
  const avgPrior7 = avg(prior7);
  const avgOlder30 = avg(older30);
  const weight: VitaluWeightTrend = {
    todayKg: weightLogs[0]?.kg ?? fields.currentWeightKg,
    average7dKg: avgRecent7,
    change30dKg:
      avgRecent7 != null && avgOlder30 != null ? (avgRecent7 as number) - (avgOlder30 as number) : null,
    goalKg: fields.goalWeightKg,
  };
  const weightChange7dKg =
    avgRecent7 != null && avgPrior7 != null ? (avgRecent7 as number) - (avgPrior7 as number) : null;

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
    score.trend === "up"
      ? "Improving"
      : score.trend === "down"
        ? "Slipping"
        : score.trend === "steady"
          ? "Steady"
          : score.total == null
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
    activeMinutesToday,
    restingHr,
    mergedToday,
    recoveryRecommended,
    healthTrend,
    workoutsCompletedThisWeek,
    calendarPacked,
    setupComplete,
    hasWorkoutToday: Boolean(todayWorkout),
    weightChange7dKg,
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
    activeMinutesToday,
    restingHr,
    heartRateAvg,
    sleepingBodyTempC,
    sleepingBodyTempBaselineC,
    sleepHoursLastNight: sleepHours,
    sleepAsOfDayKey: lastNight.asOfDayKey,
    healthCorrelation: mergedToday,
    correlationInsights: derived.correlationInsights,
    informationalBmi: bmi,
    setupComplete,
    recoveryRecommended,
    healthTrend,
    workoutsCompletedThisWeek,
    calendarPacked,
    derived,
  };
}

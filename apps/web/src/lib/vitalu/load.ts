import { prisma } from "@forward/database";
import type {
  VitaluActivityLevel,
  VitaluPlanIntent,
  VitaluProfileFields,
  VitaluScore,
  VitaluSex,
  VitaluUnits,
  VitaluWeightTrend,
} from "@forward/shared";
import { buildVitaluScore } from "@/lib/vitalu/vital-score";
import { informationalBmi } from "@/lib/vitalu/plan-targets";

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

  const [weightLogs, metrics, user] = await Promise.all([
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

  const score: VitaluScore = buildVitaluScore({
    caloriesConsumed: null,
    calorieTarget: fields.calorieTarget,
    proteinConsumedG: null,
    proteinTargetG: fields.proteinTargetG,
    stepsToday,
    stepsTarget: fields.stepsTarget,
    workoutsCompletedThisWeek: null,
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

  return {
    profile: fields,
    birthYear: user?.birthYear ?? null,
    score,
    weight,
    stepsToday,
    sleepHoursLastNight: sleepMinutes != null ? Math.round((sleepMinutes / 60) * 10) / 10 : null,
    informationalBmi: bmi,
    setupComplete,
  };
}

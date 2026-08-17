import type { VitaluScore, VitaluScoreBreakdown } from "@forward/shared";

export type VitaluScoreSignals = {
  caloriesConsumed: number | null;
  calorieTarget: number | null;
  proteinConsumedG: number | null;
  proteinTargetG: number | null;
  stepsToday: number | null;
  stepsTarget: number | null;
  workoutsCompletedThisWeek: number | null;
  workoutsPerWeek: number | null;
  sleepHoursLastNight: number | null;
  daysWithSignalLast7: number | null;
};

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function nutritionScore(s: VitaluScoreSignals): VitaluScoreBreakdown {
  if (s.caloriesConsumed == null || !s.calorieTarget) {
    return {
      key: "nutrition",
      label: "Nutrition",
      score: null,
      reason: "Log meals to score nutrition against your plan.",
    };
  }
  const calRatio = s.caloriesConsumed / s.calorieTarget;
  const calPts = calRatio <= 1.05 ? 100 * (1 - Math.abs(1 - calRatio)) : Math.max(0, 100 - (calRatio - 1) * 120);
  let proteinPts = 70;
  if (s.proteinConsumedG != null && s.proteinTargetG) {
    proteinPts = clampScore((s.proteinConsumedG / s.proteinTargetG) * 100);
  }
  const score = clampScore(calPts * 0.7 + proteinPts * 0.3);
  return {
    key: "nutrition",
    label: "Nutrition",
    score,
    reason: `About ${Math.round(s.caloriesConsumed)} of ${s.calorieTarget} kcal logged today.`,
  };
}

function movementScore(s: VitaluScoreSignals): VitaluScoreBreakdown {
  const hasSteps = s.stepsToday != null && s.stepsTarget;
  const hasWorkouts = s.workoutsCompletedThisWeek != null && s.workoutsPerWeek;
  if (!hasSteps && !hasWorkouts) {
    return {
      key: "movement",
      label: "Movement",
      score: null,
      reason: "Steps or a planned workout will fill this in.",
    };
  }
  const stepPts = hasSteps ? clampScore(((s.stepsToday ?? 0) / (s.stepsTarget ?? 1)) * 100) : 0;
  const workoutPts = hasWorkouts
    ? clampScore(((s.workoutsCompletedThisWeek ?? 0) / (s.workoutsPerWeek ?? 1)) * 100)
    : 0;
  const score = hasSteps && hasWorkouts ? clampScore(stepPts * 0.5 + workoutPts * 0.5) : stepPts || workoutPts;
  return {
    key: "movement",
    label: "Movement",
    score,
    reason: hasSteps
      ? `${Math.round(s.stepsToday ?? 0).toLocaleString()} steps vs ${s.stepsTarget?.toLocaleString()} target.`
      : `${s.workoutsCompletedThisWeek} of ${s.workoutsPerWeek} workouts this week.`,
  };
}

function recoveryScore(s: VitaluScoreSignals): VitaluScoreBreakdown {
  if (s.sleepHoursLastNight == null) {
    return {
      key: "recovery",
      label: "Recovery",
      score: null,
      reason: "Sleep last night (manual or Health Connect) scores recovery.",
    };
  }
  const h = s.sleepHoursLastNight;
  let score = 40;
  if (h >= 7 && h <= 9) score = 100;
  else if (h >= 6 && h < 7) score = 75;
  else if (h > 9 && h <= 10) score = 80;
  else if (h >= 5) score = 55;
  return {
    key: "recovery",
    label: "Recovery",
    score,
    reason: `Last night: ${h.toFixed(1)} h (wellness target 7–9 h).`,
  };
}

function consistencyScore(s: VitaluScoreSignals): VitaluScoreBreakdown {
  if (s.daysWithSignalLast7 == null) {
    return {
      key: "consistency",
      label: "Consistency",
      score: null,
      reason: "A week of any Vitalu signal (weight, steps, sleep, meals) fills this in.",
    };
  }
  const score = clampScore((s.daysWithSignalLast7 / 7) * 100);
  return {
    key: "consistency",
    label: "Consistency",
    score,
    reason: `Signals on ${s.daysWithSignalLast7} of the last 7 days.`,
  };
}

const WEIGHTS: Record<VitaluScoreBreakdown["key"], number> = {
  nutrition: 0.3,
  movement: 0.3,
  recovery: 0.2,
  consistency: 0.2,
};

export function buildVitaluScore(signals: VitaluScoreSignals): VitaluScore {
  const components = [
    nutritionScore(signals),
    movementScore(signals),
    recoveryScore(signals),
    consistencyScore(signals),
  ];
  const present = components.filter((c) => c.score != null);
  const missing = components.filter((c) => c.score == null).map((c) => c.label);

  if (present.length < 2) {
    return {
      total: null,
      trend: "unknown",
      components,
      missing,
      explanation:
        missing.length > 0
          ? `Not enough yet. Add ${missing.join(" and ")} so Vital Score can be calculated transparently.`
          : "Not enough yet.",
    };
  }

  const weightSum = present.reduce((s, c) => s + WEIGHTS[c.key], 0);
  const total = Math.round(
    present.reduce((s, c) => s + (c.score ?? 0) * WEIGHTS[c.key], 0) / weightSum
  );

  return {
    total,
    trend: "unknown",
    components,
    missing,
    explanation: present.map((c) => `${c.label} ${c.score}`).join(" · ") + (missing.length ? `. Missing: ${missing.join(", ")}.` : "."),
  };
}

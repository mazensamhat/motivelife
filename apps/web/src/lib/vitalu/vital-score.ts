import type { VitaluScore, VitaluScoreBreakdown } from "@forward/shared";

export type VitaluScoreSignals = {
  caloriesConsumed: number | null;
  calorieTarget: number | null;
  proteinConsumedG: number | null;
  proteinTargetG: number | null;
  stepsToday: number | null;
  stepsTarget: number | null;
  activeMinutesToday: number | null;
  workoutsCompletedThisWeek: number | null;
  workoutsPerWeek: number | null;
  sleepHoursLastNight: number | null;
  restingHr: number | null;
  /** Overnight wrist / sleeping body temperature in °C (Apple Sleeping Wrist Temperature, etc.). */
  sleepingBodyTempC: number | null;
  /** Personal baseline temp °C — when null, temp contributes lightly via absolute band only. */
  sleepingBodyTempBaselineC: number | null;
  daysWithSignalLast7: number | null;
  /** Prior-period Vital Score total for week-over-week trend (optional). */
  priorTotal: number | null;
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
  const hasActive = s.activeMinutesToday != null && s.activeMinutesToday > 0;
  const hasWorkouts = s.workoutsCompletedThisWeek != null && s.workoutsPerWeek;
  if (!hasSteps && !hasActive && !hasWorkouts) {
    return {
      key: "movement",
      label: "Movement",
      score: null,
      reason: "Steps, active minutes, or a planned workout will fill this in.",
    };
  }
  const stepPts = hasSteps ? clampScore(((s.stepsToday ?? 0) / (s.stepsTarget ?? 1)) * 100) : 0;
  const activePts = hasActive ? clampScore(((s.activeMinutesToday ?? 0) / 30) * 100) : 0;
  const workoutPts = hasWorkouts
    ? clampScore(((s.workoutsCompletedThisWeek ?? 0) / (s.workoutsPerWeek ?? 1)) * 100)
    : 0;

  const signals = [stepPts, activePts, workoutPts].filter((n) => n > 0);
  const scoreFixed = signals.length
    ? clampScore(signals.reduce((a, b) => a + b, 0) / signals.length)
    : 0;

  const reasonParts: string[] = [];
  if (hasSteps) {
    reasonParts.push(
      `${Math.round(s.stepsToday ?? 0).toLocaleString()} steps vs ${s.stepsTarget?.toLocaleString()} target`
    );
  }
  if (hasActive) {
    reasonParts.push(`${Math.round(s.activeMinutesToday ?? 0)} active min`);
  }
  if (hasWorkouts && !hasSteps && !hasActive) {
    reasonParts.push(`${s.workoutsCompletedThisWeek} of ${s.workoutsPerWeek} workouts this week`);
  }

  return {
    key: "movement",
    label: "Movement",
    score: scoreFixed,
    reason: reasonParts.join(" · ") + ".",
  };
}

function tempScore(tempC: number, baselineC: number | null): number {
  if (baselineC != null && Number.isFinite(baselineC)) {
    const delta = tempC - baselineC;
    // Mild overnight elevation vs personal baseline → watch; near baseline → good.
    if (Math.abs(delta) <= 0.15) return 100;
    if (Math.abs(delta) <= 0.3) return 85;
    if (delta > 0.5) return 55;
    if (delta < -0.4) return 70;
    return 75;
  }
  // Absolute Celsius band without baseline (wellness heuristic only).
  if (tempC >= 35.8 && tempC <= 36.8) return 90;
  if (tempC >= 35.5 && tempC <= 37.0) return 75;
  return 60;
}

function recoveryScore(s: VitaluScoreSignals): VitaluScoreBreakdown {
  if (s.sleepHoursLastNight == null && s.restingHr == null && s.sleepingBodyTempC == null) {
    return {
      key: "recovery",
      label: "Recovery",
      score: null,
      reason: "Sleep, resting heart rate, or overnight body temperature from a wearable scores recovery.",
    };
  }
  let sleepPts: number | null = null;
  if (s.sleepHoursLastNight != null) {
    const h = s.sleepHoursLastNight;
    if (h >= 7 && h <= 9) sleepPts = 100;
    else if (h >= 6 && h < 7) sleepPts = 75;
    else if (h > 9 && h <= 10) sleepPts = 80;
    else if (h >= 5) sleepPts = 55;
    else sleepPts = 40;
  }

  let hrPts: number | null = null;
  if (s.restingHr != null) {
    const hr = s.restingHr;
    if (hr <= 62) hrPts = 100;
    else if (hr <= 68) hrPts = 85;
    else if (hr <= 75) hrPts = 70;
    else hrPts = 55;
  }

  let tempPts: number | null = null;
  if (s.sleepingBodyTempC != null) {
    tempPts = tempScore(s.sleepingBodyTempC, s.sleepingBodyTempBaselineC);
  }

  const parts = [sleepPts, hrPts, tempPts].filter((n): n is number => n != null);
  const score = parts.length ? clampScore(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  if (score == null) {
    return {
      key: "recovery",
      label: "Recovery",
      score: null,
      reason: "Sleep, resting heart rate, or overnight body temperature from a wearable scores recovery.",
    };
  }

  const detail: string[] = [];
  if (s.sleepHoursLastNight != null) {
    detail.push(`Last night: ${s.sleepHoursLastNight.toFixed(1)} h`);
  }
  if (s.restingHr != null) {
    detail.push(`Resting HR: ${Math.round(s.restingHr)} bpm`);
  }
  if (s.sleepingBodyTempC != null) {
    detail.push(`Sleep temp: ${s.sleepingBodyTempC.toFixed(1)}°C`);
  }

  return {
    key: "recovery",
    label: "Recovery",
    score,
    reason: `${detail.join(" · ")} (wellness target 7–9 h sleep).`,
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

function trendFromTotals(
  total: number | null,
  prior: number | null
): VitaluScore["trend"] {
  if (total == null || prior == null) return "unknown";
  const delta = total - prior;
  if (delta >= 4) return "up";
  if (delta <= -4) return "down";
  return "steady";
}

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
    trend: trendFromTotals(total, signals.priorTotal),
    components,
    missing,
    explanation:
      present.map((c) => `${c.label} ${c.score}`).join(" · ") +
      (missing.length ? `. Missing: ${missing.join(", ")}.` : "."),
  };
}

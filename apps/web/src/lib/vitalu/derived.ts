import type { VitaluDerivedInsight, VitaluNutritionToday, VitaluProfileFields, VitaluScore } from "@forward/shared";
import { getCalendarEvents } from "@/lib/calendar-events";

export async function isCalendarPackedToday(userId: string): Promise<boolean> {
  try {
    const events = await getCalendarEvents(userId, 1);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const today = events.filter((e) => e.start >= start && e.start < end);
    const hours = today.reduce((s, e) => {
      const ms = Math.max(0, e.end.getTime() - e.start.getTime());
      return s + ms / 3600000;
    }, 0);
    return today.length >= 4 || hours >= 5;
  } catch {
    return false;
  }
}

export function nextVitaluAction(input: {
  setupComplete: boolean;
  recoveryRecommended: boolean;
  calendarPacked: boolean;
  hasFoodToday: boolean;
  hasWorkoutToday: boolean;
  remainingKcal: number | null;
}): string {
  if (!input.setupComplete) return "Confirm a wellness plan so Vitalu can personalize today.";
  if (input.recoveryRecommended) return "Recovery day — walk and mobility, not a hard session.";
  if (input.calendarPacked && !input.hasWorkoutToday) {
    return "Calendar is packed. A 15-minute session still counts.";
  }
  if (!input.hasFoodToday) return "Log a meal so nutrition can join Vital Score.";
  if (!input.hasWorkoutToday) return "Assemble today’s workout.";
  if (input.remainingKcal != null && input.remainingKcal > 400) {
    return `${input.remainingKcal.toLocaleString()} kcal left — keep logging.`;
  }
  return "Trend over a single weigh-in. Log weight when you can.";
}

export function toVitaluDerivedInsight(input: {
  profile: VitaluProfileFields;
  score: VitaluScore;
  nutrition: VitaluNutritionToday;
  sleepHours: number | null;
  stepsToday: number | null;
  recoveryRecommended: boolean;
  healthTrend: string;
  workoutsCompletedThisWeek: number;
  calendarPacked: boolean;
  setupComplete: boolean;
  hasWorkoutToday: boolean;
}): VitaluDerivedInsight {
  return {
    vitalScore: input.score.total,
    healthTrend: input.healthTrend,
    remainingKcal: input.nutrition.remainingKcal,
    recoveryRecommended: input.recoveryRecommended,
    workoutsCompletedThisWeek: input.workoutsCompletedThisWeek,
    workoutsPerWeek: input.profile.workoutsPerWeek,
    sleepHours: input.sleepHours,
    stepsToday: input.stepsToday,
    calendarPacked: input.calendarPacked,
    nextAction: nextVitaluAction({
      setupComplete: input.setupComplete,
      recoveryRecommended: input.recoveryRecommended,
      calendarPacked: input.calendarPacked,
      hasFoodToday: input.nutrition.logs.length > 0,
      hasWorkoutToday: input.hasWorkoutToday,
      remainingKcal: input.nutrition.remainingKcal,
    }),
  };
}

import type { VitaluNutritionToday, VitaluProfileFields, VitaluScore, VitaluWorkoutSession } from "@forward/shared";
import { VITALU_WELLNESS_DISCLAIMER } from "@forward/shared";
import { assembleVitaluWorkout } from "@/lib/vitalu/workout-engine";
import { parseTellVitalu } from "@/lib/vitalu/food-catalog";

export function answerVitalu(input: {
  message: string;
  profile: VitaluProfileFields;
  score: VitaluScore;
  nutrition: VitaluNutritionToday;
  sleepHours: number | null;
  stepsToday: number | null;
  recoveryRecommended: boolean;
  healthTrend: string;
}): { answer: string; workout: VitaluWorkoutSession | null } {
  const q = input.message.trim().toLowerCase();
  const remaining = input.nutrition.remainingKcal;
  const target = input.profile.calorieTarget;

  if (/diagnos|apnea|diabet|hypertens|symptom|treat my/.test(q)) {
    return {
      answer: `${VITALU_WELLNESS_DISCLAIMER} I can talk about your plan, sleep trend, workouts, and calories — not medical conditions.`,
      workout: null,
    };
  }

  if (/calories? left|how many calories|left today/.test(q)) {
    if (target == null) {
      return { answer: "Set a Vitalu plan first and I’ll tell you what’s left today.", workout: null };
    }
    return {
      answer: `You’ve logged about ${Math.round(input.nutrition.kcal)} of ${target} kcal. About ${remaining} remaining — a wellness estimate, not a prescription.`,
      workout: null,
    };
  }

  if (/eat for dinner|what should i eat|dinner/.test(q) && /eat|food|dinner|hungry/.test(q)) {
    if (remaining == null) {
      return { answer: "Confirm your plan first. Then I can suggest dinner against your remaining calories.", workout: null };
    }
    if (remaining < 250) {
      return {
        answer: `You’re near today’s calorie target (${remaining} kcal left). A protein-forward plate — chicken or tofu, vegetables, and a small starch — fits better than a heavy restaurant meal.`,
        workout: null,
      };
    }
    return {
      answer: `About ${remaining} kcal left. A simple dinner: lean protein + vegetables + a cup of rice or potato. Log it after so Vital Score can see nutrition.`,
      workout: null,
    };
  }

  if (/yoga/.test(q)) {
    const workout = assembleVitaluWorkout({
      minutes: 20,
      equipment: "MAT",
      yoga: true,
      sleepHours: input.sleepHours,
      lastFeedback: input.profile.lastWorkoutFeedback ?? null,
    });
    return { answer: `Beginner yoga, ${workout.minutes} minutes. ${workout.reason}`, workout };
  }

  if (/workout|exercise|gym|home|15 min|20 min|18 min/.test(q)) {
    const mins = q.match(/(\d+)\s*min/) ? Number(q.match(/(\d+)\s*min/)![1]) : 20;
    const equipment = /dumbbell/.test(q) ? "DUMBBELLS" : /band/.test(q) ? "BANDS" : /gym/.test(q) ? "GYM" : "NONE";
    const workout = assembleVitaluWorkout({
      minutes: mins,
      equipment,
      sleepHours: input.sleepHours,
      lastFeedback: input.profile.lastWorkoutFeedback ?? null,
    });
    return { answer: `${workout.title}. ${workout.reason} Save it on Today if you want Vitalu to track it.`, workout };
  }

  if (/weight.*move|hasn't moved|not losing|scale/.test(q)) {
    return {
      answer: `Daily weight jumps around. Vitalu watches the 7-day average. Sleep, restaurant meals, and missed workouts move the trend more than one weigh-in. ${input.healthTrend === "Unknown" ? "Log a few more days so the trend is real." : `Right now your health trend reads ${input.healthTrend}.`}`,
      workout: null,
    };
  }

  if (/how am i doing|this month|progress/.test(q)) {
    const score = input.score.total != null ? `Vital Score ${input.score.total}. ` : "";
    return {
      answer: `${score}${input.score.explanation} Trend: ${input.healthTrend}. ${VITALU_WELLNESS_DISCLAIMER}`,
      workout: null,
    };
  }

  if (/don't feel|dont feel|no gym|at home/.test(q)) {
    const workout = assembleVitaluWorkout({
      minutes: 15,
      equipment: "NONE",
      sleepHours: input.sleepHours,
      lastFeedback: input.profile.lastWorkoutFeedback ?? null,
    });
    return { answer: `Stay home. ${workout.title}. ${workout.reason}`, workout };
  }

  const parsed = parseTellVitalu(input.message);
  if (parsed.length) {
    const kcal = parsed.reduce((s, f) => s + f.kcal, 0);
    return {
      answer: `Estimated ${kcal} kcal (${parsed.map((f) => f.name).join(", ")}). Confirm on Today if that looks right — I won’t log it from chat until you do.`,
      workout: null,
    };
  }

  return {
    answer: `Ask me what’s left to eat, a 15-minute workout, why weight is noisy, or how you’re doing. ${input.score.total != null ? `Vital Score is ${input.score.total}.` : "Finish setup so I have a plan to reason from."} ${VITALU_WELLNESS_DISCLAIMER}`,
    workout: null,
  };
}

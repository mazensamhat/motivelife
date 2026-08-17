/** Vitalu — Health Intelligence shared types (wellness, not medical). */

export const VITALU_PLAN_INTENTS = [
  "LOSE_WEIGHT",
  "BUILD_MUSCLE",
  "IMPROVE_FITNESS",
  "MAINTAIN_WEIGHT",
  "GET_MORE_ACTIVE",
  "IMPROVE_FLEXIBILITY",
  "BUILD_HEALTHY_HABITS",
] as const;
export type VitaluPlanIntent = (typeof VITALU_PLAN_INTENTS)[number];

export const VITALU_PLAN_INTENT_LABELS: Record<VitaluPlanIntent, string> = {
  LOSE_WEIGHT: "Lose Weight",
  BUILD_MUSCLE: "Build Muscle",
  IMPROVE_FITNESS: "Improve Fitness",
  MAINTAIN_WEIGHT: "Maintain Weight",
  GET_MORE_ACTIVE: "Get More Active",
  IMPROVE_FLEXIBILITY: "Improve Flexibility",
  BUILD_HEALTHY_HABITS: "Build Healthy Habits",
};

export const VITALU_ACTIVITY_LEVELS = [
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
] as const;
export type VitaluActivityLevel = (typeof VITALU_ACTIVITY_LEVELS)[number];

export const VITALU_ACTIVITY_LABELS: Record<VitaluActivityLevel, string> = {
  SEDENTARY: "Sedentary",
  LIGHT: "Light",
  MODERATE: "Moderate",
  ACTIVE: "Active",
  VERY_ACTIVE: "Very active",
};

export const VITALU_ACTIVITY_FACTORS: Record<VitaluActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export const VITALU_SEXES = ["FEMALE", "MALE", "UNSPECIFIED"] as const;
export type VitaluSex = (typeof VITALU_SEXES)[number];

export const VITALU_UNITS = ["METRIC", "IMPERIAL"] as const;
export type VitaluUnits = (typeof VITALU_UNITS)[number];

export const VITALU_SCORE_COMPONENTS = ["nutrition", "movement", "recovery", "consistency"] as const;
export type VitaluScoreComponent = (typeof VITALU_SCORE_COMPONENTS)[number];

export interface VitaluProfileFields {
  biologicalSex: VitaluSex | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  activityLevel: VitaluActivityLevel | null;
  planIntent: VitaluPlanIntent | null;
  units: VitaluUnits;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  waterTargetMl: number | null;
  stepsTarget: number | null;
  workoutsPerWeek: number | null;
  vaultShareLifeGraph: boolean;
  vaultShareVyra: boolean;
  lastWorkoutFeedback?: VitaluWorkoutFeedback | null;
}

export interface VitaluPlanTargets {
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  waterTargetMl: number;
  stepsTarget: number;
  workoutsPerWeek: number;
  bmr: number;
  tdee: number;
  /** True when sex was unspecified and BMR used the midpoint. */
  bmrUsedMidpoint: boolean;
}

export interface VitaluScoreBreakdown {
  key: VitaluScoreComponent;
  label: string;
  score: number | null;
  reason: string;
}

export interface VitaluScore {
  /** Null when fewer than two components have data. */
  total: number | null;
  trend: "up" | "down" | "steady" | "unknown";
  components: VitaluScoreBreakdown[];
  missing: string[];
  explanation: string;
}

export interface VitaluWeightPoint {
  kg: number;
  recordedAt: string;
  source: string;
}

export interface VitaluWeightTrend {
  todayKg: number | null;
  average7dKg: number | null;
  change30dKg: number | null;
  goalKg: number | null;
}

export const VITALU_MEAL_SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
export type VitaluMealSlot = (typeof VITALU_MEAL_SLOTS)[number];

export const VITALU_MEAL_SLOT_LABELS: Record<VitaluMealSlot, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snacks",
};

export const VITALU_EQUIPMENT = ["NONE", "DUMBBELLS", "BANDS", "GYM", "MAT"] as const;
export type VitaluEquipment = (typeof VITALU_EQUIPMENT)[number];

export const VITALU_WORKOUT_FEEDBACK = ["TOO_EASY", "PERFECT", "TOO_HARD"] as const;
export type VitaluWorkoutFeedback = (typeof VITALU_WORKOUT_FEEDBACK)[number];

export interface VitaluFoodItem {
  id: string;
  name: string;
  servingLabel: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
}

export interface VitaluFoodLogRow extends VitaluFoodItem {
  logId: string;
  mealSlot: VitaluMealSlot;
  eatenAt: string;
}

export interface VitaluNutritionToday {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  remainingKcal: number | null;
  logs: VitaluFoodLogRow[];
}

export interface VitaluExerciseBlock {
  id: string;
  name: string;
  prescription: string;
  instructions: string;
}

export interface VitaluWorkoutSession {
  title: string;
  minutes: number;
  equipment: VitaluEquipment;
  recovery: boolean;
  reason: string;
  blocks: VitaluExerciseBlock[];
}

export interface VitaluWorkoutRow {
  id: string;
  plannedFor: string;
  completedAt: string | null;
  feedback: VitaluWorkoutFeedback | null;
  session: VitaluWorkoutSession;
}

export const VITALU_WELLNESS_DISCLAIMER =
  "Vitalu is general wellness software. It does not diagnose, treat, or manage medical conditions.";

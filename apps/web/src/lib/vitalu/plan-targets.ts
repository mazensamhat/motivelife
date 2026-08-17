import type {
  VitaluActivityLevel,
  VitaluPlanIntent,
  VitaluPlanTargets,
  VitaluSex,
} from "@forward/shared";
import { VITALU_ACTIVITY_FACTORS } from "@forward/shared";

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function ageFromBirthYear(birthYear: number | null | undefined) {
  if (!birthYear || birthYear < 1900) return 35;
  return clamp(new Date().getFullYear() - birthYear, 16, 90);
}

/** Mifflin–St Jeor BMR (kcal). Midpoint when sex is unspecified. */
export function mifflinStJeorBmr(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: VitaluSex | null;
}): { bmr: number; usedMidpoint: boolean } {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  const male = base + 5;
  const female = base - 161;
  if (input.sex === "MALE") return { bmr: male, usedMidpoint: false };
  if (input.sex === "FEMALE") return { bmr: female, usedMidpoint: false };
  return { bmr: (male + female) / 2, usedMidpoint: true };
}

export function proposeVitaluTargets(input: {
  weightKg: number;
  heightCm: number;
  birthYear?: number | null;
  sex: VitaluSex | null;
  activityLevel: VitaluActivityLevel;
  planIntent: VitaluPlanIntent;
}): VitaluPlanTargets {
  const age = ageFromBirthYear(input.birthYear);
  const { bmr, usedMidpoint } = mifflinStJeorBmr({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    age,
    sex: input.sex,
  });
  const tdee = bmr * VITALU_ACTIVITY_FACTORS[input.activityLevel];

  let calories = tdee;
  if (input.planIntent === "LOSE_WEIGHT") calories = tdee - 400;
  if (input.planIntent === "BUILD_MUSCLE") calories = tdee + 250;

  const floor = input.sex === "MALE" ? 1500 : 1200;
  calories = clamp(Math.round(calories), floor, Math.round(tdee + 500));

  const proteinPerKg =
    input.planIntent === "LOSE_WEIGHT" || input.planIntent === "BUILD_MUSCLE" ? 1.6 : 1.2;
  const proteinTargetG = Math.round(proteinPerKg * input.weightKg);
  const fatTargetG = Math.round((calories * 0.28) / KCAL_PER_G_FAT);
  const carbsKcal = Math.max(0, calories - proteinTargetG * KCAL_PER_G_PROTEIN - fatTargetG * KCAL_PER_G_FAT);
  const carbsTargetG = Math.round(carbsKcal / KCAL_PER_G_CARBS);
  const waterTargetMl = clamp(Math.round(input.weightKg * 33), 2000, 3500);
  const stepsTarget = input.planIntent === "GET_MORE_ACTIVE" ? 10_000 : 8_000;
  const workoutsPerWeek =
    input.planIntent === "IMPROVE_FLEXIBILITY" || input.planIntent === "BUILD_HEALTHY_HABITS"
      ? 2
      : input.planIntent === "BUILD_MUSCLE" || input.planIntent === "IMPROVE_FITNESS"
        ? 4
        : 3;

  return {
    calorieTarget: calories,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    waterTargetMl,
    stepsTarget,
    workoutsPerWeek,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    bmrUsedMidpoint: usedMidpoint,
  };
}

export function kgFromLb(lb: number) {
  return lb / 2.2046226218;
}

export function lbFromKg(kg: number) {
  return kg * 2.2046226218;
}

export function cmFromIn(inches: number) {
  return inches * 2.54;
}

export function inFromCm(cm: number) {
  return cm / 2.54;
}

/** Informational BMI (kg/m²). Never a diagnosis. */
export function informationalBmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  if (m <= 0) return null;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

import { buildVitaluScore } from "./vital-score";
import { informationalBmi, parseHeightToCm, parseWeightToKg, proposeVitaluTargets } from "./plan-targets";
import { groceryWeeklyEstimate, overlayVitaluOnSleepScenario } from "@forward/shared";
import { getVitaluFood, listVitaluCatalogFoods, parseTellVitalu, searchVitaluFoods } from "./food-catalog";
import { listVitaluExercises } from "./exercise-catalog";
import { assembleVitaluWorkout } from "./workout-engine";
import { answerVitalu } from "./ask";
import type { VitaluNutritionToday, VitaluProfileFields, VitaluScore } from "@forward/shared";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const plan = proposeVitaluTargets({
  weightKg: 94,
  heightCm: 178,
  birthYear: 1988,
  sex: "MALE",
  activityLevel: "LIGHT",
  planIntent: "LOSE_WEIGHT",
});
assert(plan.calorieTarget >= 1500, "male floor");
assert(plan.proteinTargetG >= 140, "protein ~1.6 g/kg");
assert(plan.bmr > 1600 && plan.bmr < 2200, "plausible BMR");
assert(!plan.bmrUsedMidpoint, "sex specified");

const incomplete = buildVitaluScore({
  caloriesConsumed: null,
  calorieTarget: plan.calorieTarget,
  proteinConsumedG: null,
  proteinTargetG: plan.proteinTargetG,
  stepsToday: 6842,
  stepsTarget: 10000,
  activeMinutesToday: null,
  workoutsCompletedThisWeek: null,
  workoutsPerWeek: 3,
  sleepHoursLastNight: null,
  restingHr: null,
  sleepingBodyTempC: null,
  sleepingBodyTempBaselineC: null,
  daysWithSignalLast7: null,
  priorTotal: null,
});
assert(incomplete.total === null, "one component is not enough");

const enough = buildVitaluScore({
  caloriesConsumed: null,
  calorieTarget: plan.calorieTarget,
  proteinConsumedG: null,
  proteinTargetG: plan.proteinTargetG,
  stepsToday: 6842,
  stepsTarget: 10000,
  activeMinutesToday: 22,
  workoutsCompletedThisWeek: 2,
  workoutsPerWeek: 3,
  sleepHoursLastNight: 7.5,
  restingHr: 64,
  sleepingBodyTempC: 36.4,
  sleepingBodyTempBaselineC: 36.35,
  daysWithSignalLast7: 5,
  priorTotal: 62,
});
assert(enough.total != null && enough.total >= 50 && enough.total <= 100, "score in range");
assert(enough.components.find((c) => c.key === "nutrition")?.score == null, "no fake nutrition");
assert(enough.trend === "up" || enough.trend === "steady", "priorTotal drives real trend");
assert(enough.components.find((c) => c.key === "recovery")?.score != null, "temp helps recovery");

const bmi = informationalBmi(94, 178);
assert(bmi != null && bmi > 25 && bmi < 35, "informational BMI");
assert(Math.abs((parseHeightToCm(70) ?? 0) - 177.8) < 0.3, "70 inches");
assert(Math.abs((parseHeightToCm("5.10") ?? 0) - 177.8) < 0.3, "5.10 feet.inches");
assert(parseHeightToCm(178) === 178, "cm passthrough");
assert(Math.abs((parseWeightToKg(207, "IMPERIAL") ?? 0) - 94) < 0.5, "207 lb");
assert(parseWeightToKg(94, "METRIC") === 94, "94 kg");
assert(Math.abs((parseWeightToKg(207, "METRIC") ?? 0) - 94) < 0.5, "207 on metric is lb");

const chicken = searchVitaluFoods("chicken")[0];
assert(chicken?.id === "chicken-breast", "catalog search");
const egg = getVitaluFood("egg-large");
assert(egg != null && egg.kcal > 50 && egg.kcal < 90, "egg serving kcal");
const told = parseTellVitalu("2 eggs, toast with butter, coffee");
assert(told.length >= 3, "tell vitalu breakfast");
assert(told.reduce((s, f) => s + f.kcal, 0) > 200, "breakfast estimate");

const home = assembleVitaluWorkout({ minutes: 20, equipment: "NONE", lastFeedback: "TOO_EASY" });
assert(home.blocks.length >= 4, "assembled session");
assert(!home.recovery, "normal sleep");
const recovery = assembleVitaluWorkout({ minutes: 20, equipment: "NONE", sleepHours: 5.5 });
assert(recovery.recovery, "sleep under 6h is recovery");
const yoga = assembleVitaluWorkout({ minutes: 20, equipment: "MAT", yoga: true });
assert(/yoga/i.test(yoga.title), "yoga assembler");

const profile: VitaluProfileFields = {
  biologicalSex: "MALE",
  heightCm: 178,
  currentWeightKg: 94,
  goalWeightKg: 88,
  activityLevel: "LIGHT",
  planIntent: "LOSE_WEIGHT",
  units: "METRIC",
  calorieTarget: plan.calorieTarget,
  proteinTargetG: plan.proteinTargetG,
  carbsTargetG: plan.carbsTargetG,
  fatTargetG: plan.fatTargetG,
  waterTargetMl: plan.waterTargetMl,
  stepsTarget: plan.stepsTarget,
  workoutsPerWeek: plan.workoutsPerWeek,
  vaultShareLifeGraph: false,
  vaultShareVyra: false,
};
const nutrition: VitaluNutritionToday = {
  kcal: 1400,
  proteinG: 90,
  carbsG: 140,
  fatG: 50,
  fiberG: 18,
  waterMl: 500,
  remainingKcal: plan.calorieTarget - 1400,
  remainingProteinG: plan.proteinTargetG - 90,
  remainingWaterMl: plan.waterTargetMl - 500,
  logs: [],
};
const score: VitaluScore = enough;
const left = answerVitalu({
  message: "How many calories left today?",
  profile,
  score,
  nutrition,
  sleepHours: 7,
  stepsToday: 6842,
  recoveryRecommended: false,
  healthTrend: "Steady",
});
assert(/remaining/i.test(left.answer), "ask calories left");
const refuse = answerVitalu({
  message: "Diagnose my diabetes symptoms",
  profile,
  score,
  nutrition,
  sleepHours: 7,
  stepsToday: 6842,
  recoveryRecommended: false,
  healthTrend: "Steady",
});
assert(/does not diagnose/i.test(refuse.answer), "ask refuses diagnosis");
const workAsk = answerVitalu({
  message: "Give me a 15 min home workout",
  profile,
  score,
  nutrition,
  sleepHours: 7,
  stepsToday: 6842,
  recoveryRecommended: false,
  healthTrend: "Steady",
});
assert(workAsk.workout != null && workAsk.workout.minutes === 15, "ask assembles workout");
const proteinAsk = answerVitalu({
  message: "How much protein left?",
  profile,
  score,
  nutrition,
  sleepHours: 7,
  stepsToday: 6842,
  recoveryRecommended: false,
  healthTrend: "Steady",
});
assert(/protein/i.test(proteinAsk.answer), "ask protein left");
const packed = answerVitalu({
  message: "workout today",
  profile,
  score,
  nutrition,
  sleepHours: 7,
  stepsToday: 6842,
  recoveryRecommended: false,
  healthTrend: "Steady",
  calendarPacked: true,
});
assert(packed.workout != null && packed.workout.minutes === 15, "packed calendar short session");
const chickenRice = parseTellVitalu("chicken and rice");
assert(chickenRice.some((f) => f.id === "chicken-breast"), "tell chicken");
assert(chickenRice.some((f) => f.id.includes("rice")), "tell rice");

assert(listVitaluCatalogFoods().length >= 220, "global food cache size");
assert(searchVitaluFoods("jollof")[0]?.id === "jollof-rice", "african jollof");
assert(searchVitaluFoods("ramen")[0]?.id === "ramen", "asian ramen");
assert(searchVitaluFoods("croissant")[0]?.id === "croissant", "european croissant");
assert(searchVitaluFoods("taco")[0]?.id === "taco", "american taco");
assert(searchVitaluFoods("shawarma")[0]?.id === "shawarma", "middle east shawarma");
assert(searchVitaluFoods("bissap")[0]?.id === "bissap", "african drink");
assert(searchVitaluFoods("flat white")[0]?.id === "flat-white", "oceania coffee");
const toldGlobal = parseTellVitalu("jollof and plantain");
assert(toldGlobal.some((f) => f.id === "jollof-rice"), "tell jollof");
assert(toldGlobal.some((f) => f.id === "plantain-fried"), "tell plantain");
assert(listVitaluExercises().length >= 35, "licensed exercise catalog size");
assert(groceryWeeklyEstimate(2000, 140) > 80, "grocery weekly estimate");
const sleepOverlay = overlayVitaluOnSleepScenario(
  {
    id: "sleep",
    scenario: "What if I sleep better?",
    summary: "Base.",
    impacts: [] as { label: string; effect: string }[],
  },
  {
    sleepHours: 5.5,
    recoveryRecommended: true,
    healthTrend: "Slipping",
    vitalScore: 62,
    vaultShareLifeGraph: true,
    nextAction: "Recovery day — walk and mobility, not a hard session.",
  }
);
assert(/Vitalu/i.test(sleepOverlay.summary), "simulator consults Vitalu");
assert(sleepOverlay.impacts.some((i) => i.label === "Vital Score"), "vital score overlay");

console.log("vitalu smoke ok", {
  calorieTarget: plan.calorieTarget,
  score: enough.total,
  bmi,
  breakfastKcal: told.reduce((s, f) => s + f.kcal, 0),
  recovery: recovery.title,
});

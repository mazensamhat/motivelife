import { buildVitaluScore } from "./vital-score";
import { informationalBmi, proposeVitaluTargets } from "./plan-targets";

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
  workoutsCompletedThisWeek: null,
  workoutsPerWeek: 3,
  sleepHoursLastNight: null,
  daysWithSignalLast7: null,
});
assert(incomplete.total === null, "one component is not enough");

const enough = buildVitaluScore({
  caloriesConsumed: null,
  calorieTarget: plan.calorieTarget,
  proteinConsumedG: null,
  proteinTargetG: plan.proteinTargetG,
  stepsToday: 6842,
  stepsTarget: 10000,
  workoutsCompletedThisWeek: 2,
  workoutsPerWeek: 3,
  sleepHoursLastNight: 7.5,
  daysWithSignalLast7: 5,
});
assert(enough.total != null && enough.total >= 50 && enough.total <= 100, "score in range");
assert(enough.components.find((c) => c.key === "nutrition")?.score == null, "no fake nutrition");

const bmi = informationalBmi(94, 178);
assert(bmi != null && bmi > 25 && bmi < 35, "informational BMI");

console.log("vitalu smoke ok", { calorieTarget: plan.calorieTarget, score: enough.total, bmi });

import type { VitaluEquipment, VitaluWorkoutFeedback, VitaluWorkoutSession } from "@forward/shared";
import { VITALU_EXERCISES, type VitaluCatalogExercise } from "./exercise-catalog";

type Movement = VitaluCatalogExercise;

const MOVES: Movement[] = VITALU_EXERCISES;

function allowed(move: Movement, equipment: VitaluEquipment) {
  return move.equipment.includes(equipment) || (equipment === "NONE" && move.equipment.includes("MAT"));
}

function levelFromFeedback(feedback: VitaluWorkoutFeedback | null): 1 | 2 | 3 {
  if (feedback === "TOO_HARD") return 1;
  if (feedback === "TOO_EASY") return 3;
  return 2;
}

function withSkipNote(move: Movement): string {
  if (!move.skipIf.length) return move.instructions;
  return `${move.instructions} Skip if this bothers ${move.skipIf.join(" or ")} — wellness, not a diagnosis.`;
}

export function assembleVitaluWorkout(input: {
  minutes: number;
  equipment: VitaluEquipment;
  lastFeedback?: VitaluWorkoutFeedback | null;
  sleepHours?: number | null;
  yoga?: boolean;
}): VitaluWorkoutSession {
  const minutes = Math.max(5, Math.min(60, Math.round(input.minutes)));
  const recovery = (input.sleepHours ?? 8) < 6;
  const level = recovery ? 1 : levelFromFeedback(input.lastFeedback ?? null);
  const pool = MOVES.filter((m) => allowed(m, input.equipment));

  if (recovery) {
    const walk = pool.find((m) => m.id === "walk") ?? MOVES.find((m) => m.id === "walk")!;
    const mob = pool.filter((m) => m.pattern === "MOBILITY").slice(0, 2);
    return {
      title: `${Math.min(minutes, 30)}-min recovery`,
      minutes: Math.min(minutes, 30),
      equipment: input.equipment,
      recovery: true,
      reason: "Sleep was under 6 hours. Vitalu recommends a lighter day — walk and mobility, not a hard session.",
      blocks: [
        {
          id: walk.id,
          name: walk.name,
          prescription: walk.prescription(1),
          instructions: withSkipNote(walk),
        },
        ...mob.map((m) => ({
          id: m.id,
          name: m.name,
          prescription: m.prescription(1),
          instructions: withSkipNote(m),
        })),
      ],
    };
  }

  if (input.yoga) {
    const yoga = pool.filter((m) => m.pattern === "MOBILITY" || m.id === "yoga-flow");
    return {
      title: `${minutes}-min beginner yoga`,
      minutes,
      equipment: input.equipment,
      recovery: false,
      reason: "Slow mobility session. Skip anything that bothers a joint — that’s wellness, not a diagnosis.",
      blocks: yoga.slice(0, 4).map((m) => ({
        id: m.id,
        name: m.name,
        prescription: m.prescription(level),
        instructions: withSkipNote(m),
      })),
    };
  }

  const pick = (pattern: Movement["pattern"]) =>
    pool.find((m) => m.pattern === pattern && m.difficulty <= level) ??
    pool.find((m) => m.pattern === pattern);

  const main = [pick("SQUAT"), pick("PUSH"), pick("LUNGE") ?? pick("HINGE"), pick("CORE")].filter(
    Boolean
  ) as Movement[];
  const pull = pick("PULL");
  if (pull) main.splice(2, 0, pull);

  const warmup = {
    id: "warmup",
    name: "Warm-up",
    prescription: "3 min",
    instructions: "March in place, arm circles, easy hip openers. Then start the first movement.",
  };
  const cooldown = {
    id: "cooldown",
    name: "Cool-down",
    prescription: "2 min",
    instructions: "Easy walk-in-place and unhurried breathing. You’re done.",
  };

  return {
    title: `${minutes}-min full body · ${input.equipment === "NONE" ? "no equipment" : input.equipment.toLowerCase()}`,
    minutes,
    equipment: input.equipment,
    recovery: false,
    reason:
      "Assembled from Vitalu’s licensed movement catalog (WHO-style: strength 2×/week is a rule underneath, not an AI guess).",
    blocks: [
      warmup,
      ...main.map((m) => ({
        id: m.id,
        name: m.name,
        prescription: m.prescription(level),
        instructions: withSkipNote(m),
      })),
      cooldown,
    ],
  };
}

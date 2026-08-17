import type { VitaluEquipment, VitaluWorkoutFeedback, VitaluWorkoutSession } from "@forward/shared";

type Movement = {
  id: string;
  name: string;
  pattern: "SQUAT" | "HINGE" | "PUSH" | "PULL" | "LUNGE" | "CORE" | "WALK" | "MOBILITY";
  equipment: VitaluEquipment[];
  difficulty: 1 | 2 | 3;
  instructions: string;
  prescription: (level: 1 | 2 | 3) => string;
};

const MOVES: Movement[] = [
  {
    id: "bodyweight-squat",
    name: "Squat",
    pattern: "SQUAT",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Feet about shoulder-width. Sit back, keep heels down, stand tall.",
    prescription: (l) => (l === 1 ? "3 × 10" : l === 2 ? "3 × 12" : "3 × 15"),
  },
  {
    id: "incline-pushup",
    name: "Incline push-up",
    pattern: "PUSH",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Hands on a counter or bench. Lower chest, press away. Keep a straight line.",
    prescription: (l) => (l === 1 ? "3 × 8" : l === 2 ? "3 × 10" : "3 × 12"),
  },
  {
    id: "pushup",
    name: "Push-up",
    pattern: "PUSH",
    equipment: ["NONE", "MAT"],
    difficulty: 2,
    instructions: "Hands under shoulders. Lower with control, press up. Knees are an allowed regression.",
    prescription: (l) => (l === 1 ? "3 × 6" : l === 2 ? "3 × 8" : "3 × 10"),
  },
  {
    id: "reverse-lunge",
    name: "Reverse lunge",
    pattern: "LUNGE",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Step back, both knees toward 90°, front heel down, stand.",
    prescription: (l) => (l === 1 ? "3 × 8/side" : l === 2 ? "3 × 10/side" : "3 × 12/side"),
  },
  {
    id: "glute-bridge",
    name: "Glute bridge",
    pattern: "HINGE",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Lie on your back, feet planted. Squeeze glutes and lift hips, lower slowly.",
    prescription: (l) => (l === 1 ? "3 × 12" : l === 2 ? "3 × 15" : "3 × 18"),
  },
  {
    id: "plank",
    name: "Plank",
    pattern: "CORE",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Elbows under shoulders, body in a line. Breathe. Drop to knees if form fades.",
    prescription: (l) => (l === 1 ? "3 × 20 sec" : l === 2 ? "3 × 30 sec" : "3 × 40 sec"),
  },
  {
    id: "dead-bug",
    name: "Dead bug",
    pattern: "CORE",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "On your back, opposite arm and leg reach away. Keep low back gently pressed down.",
    prescription: (l) => (l === 1 ? "3 × 6/side" : "3 × 8/side"),
  },
  {
    id: "row-band",
    name: "Band row",
    pattern: "PULL",
    equipment: ["BANDS"],
    difficulty: 2,
    instructions: "Anchor the band, pull elbows back, squeeze shoulder blades, control the return.",
    prescription: (l) => (l === 2 ? "3 × 12" : "3 × 15"),
  },
  {
    id: "goblet-squat",
    name: "Goblet squat",
    pattern: "SQUAT",
    equipment: ["DUMBBELLS", "GYM"],
    difficulty: 2,
    instructions: "Hold a dumbbell at your chest. Sit between your heels, stand tall.",
    prescription: (l) => (l === 2 ? "3 × 10" : "3 × 12"),
  },
  {
    id: "db-press",
    name: "Dumbbell floor press",
    pattern: "PUSH",
    equipment: ["DUMBBELLS", "GYM"],
    difficulty: 2,
    instructions: "Lie on the floor, press dumbbells up, lower until elbows kiss the floor.",
    prescription: (l) => "3 × 10",
  },
  {
    id: "rdl",
    name: "Dumbbell RDL",
    pattern: "HINGE",
    equipment: ["DUMBBELLS", "GYM"],
    difficulty: 2,
    instructions: "Soft knees, hips back, dumbbells slide down thighs, stand by squeezing glutes.",
    prescription: (l) => "3 × 10",
  },
  {
    id: "walk",
    name: "Brisk walk",
    pattern: "WALK",
    equipment: ["NONE", "MAT", "DUMBBELLS", "BANDS", "GYM"],
    difficulty: 1,
    instructions: "Easy nasal breathing if you can. Swing arms. This is still training.",
    prescription: (l) => (l === 1 ? "10–20 min" : "20 min"),
  },
  {
    id: "cat-cow",
    name: "Cat-cow",
    pattern: "MOBILITY",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "On all fours, round and arch slowly with your breath.",
    prescription: () => "1 × 8 slow breaths",
  },
  {
    id: "world-greatest",
    name: "World’s greatest stretch",
    pattern: "MOBILITY",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Lunge, hand inside the front foot, rotate the chest open, switch sides.",
    prescription: () => "4 / side",
  },
  {
    id: "down-dog",
    name: "Downward dog",
    pattern: "MOBILITY",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Hands and feet planted, hips high. Pedal the heels. Soft knees are fine.",
    prescription: () => "3 × 20 sec",
  },
  {
    id: "yoga-flow",
    name: "Beginner sun-salute flow",
    pattern: "MOBILITY",
    equipment: ["NONE", "MAT"],
    difficulty: 1,
    instructions: "Mountain → fold → plank → knees-chest-chin or knees down → cobra → down-dog → stand.",
    prescription: () => "4 slow rounds",
  },
];

function allowed(move: Movement, equipment: VitaluEquipment) {
  return move.equipment.includes(equipment) || (equipment === "NONE" && move.equipment.includes("MAT"));
}

function levelFromFeedback(feedback: VitaluWorkoutFeedback | null): 1 | 2 | 3 {
  if (feedback === "TOO_HARD") return 1;
  if (feedback === "TOO_EASY") return 3;
  return 2;
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
        { id: walk.id, name: walk.name, prescription: walk.prescription(1), instructions: walk.instructions },
        ...mob.map((m) => ({
          id: m.id,
          name: m.name,
          prescription: m.prescription(1),
          instructions: m.instructions,
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
        instructions: m.instructions,
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
    reason: "Assembled from Vitalu’s exercise engine (WHO-style: strength 2×/week is a rule underneath, not an AI guess).",
    blocks: [warmup, ...main.map((m) => ({
      id: m.id,
      name: m.name,
      prescription: m.prescription(level),
      instructions: m.instructions,
    })), cooldown],
  };
}

import type {
  LifeBelief,
  LifeContextState,
  LifeGraphPayload,
  LifePreference,
} from "@forward/shared";

export type GenerationCohort = "gen_z" | "millennial" | "gen_x" | "boomer";

export interface PersonaLayers {
  userName: string | null;
  birthYear?: number | null;
  beliefs: LifeBelief[];
  preferences: LifePreference;
  activeContext: LifeContextState | null;
  lifeDestination: string | null;
  graph: LifeGraphPayload | null;
  learnedToday: string[];
  lifeEngineStreak?: number;
  completedToday?: number;
}

export function getGenerationCohort(birthYear?: number | null): GenerationCohort | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age <= 29) return "gen_z";
  if (age <= 44) return "millennial";
  if (age <= 59) return "gen_x";
  return "boomer";
}

const COHORT_GUIDANCE: Record<GenerationCohort, string> = {
  gen_z:
    "User is Gen Z: mobile-first, short sentences, optional light humor if humor preference is on. Anticipatory not preachy. Respect privacy — never guilt-trip.",
  millennial:
    "User is Millennial: direct but warm, life-stage aware (career + money + family). One clear next action. Data-backed when statistics mode is on.",
  gen_x:
    "User is Gen X: pragmatic, no fluff, credible tone. Acknowledge time pressure and retirement/financial stakes when relevant.",
  boomer:
    "User is 50+: respectful, patient, clear language. Focus on health, relationships, legacy. Never patronizing.",
};

function toneRules(prefs: LifePreference): string {
  const lines: string[] = [
    "Speak like a trusted Chief of Staff who has known this person for years — not a chatbot.",
    "Use their name naturally once. Short sentences. One question max.",
    "End with one concrete action when coaching.",
    "Never use guilt, FOMO, or 'I miss you' manipulation.",
    "Admit uncertainty when data is thin: offer to learn more.",
  ];

  if (prefs.reminderStyle === "direct") {
    lines.push("Tone: direct and concise — no filler words.");
  } else if (prefs.reminderStyle === "statistics") {
    lines.push("Tone: cite patterns and numbers when available.");
  } else {
    lines.push("Tone: warm and encouraging without being cheesy.");
  }

  if (prefs.encouragement === false) {
    lines.push("Skip cheerleading — stay factual.");
  }
  if (prefs.humor) {
    lines.push("Light, respectful humor is OK in one line max.");
  }
  if (prefs.taskLength === "short") {
    lines.push("Frame actions as 15-minute wins.");
  } else if (prefs.taskLength === "long") {
    lines.push("User prefers deeper work blocks (~45 min).");
  }

  const peak = prefs.peakHours;
  if (peak === "night") lines.push("User peaks at night — don't push early-morning framing.");
  if (peak === "morning") lines.push("User peaks in the morning — morning framing fits.");

  return lines.join("\n");
}

export function buildPersonaSystemPrompt(layers: PersonaLayers): string {
  const cohort = getGenerationCohort(layers.birthYear);
  const beliefLabels = layers.beliefs.map((b) => b.label).join(", ") || "not yet captured";
  const graphSummary =
    layers.graph?.destination?.label != null
      ? `Life GPS destination: ${layers.graph.destination.label}. Graph has ${layers.graph.nodes.length} nodes, ${layers.graph.edges.length} connections.`
      : "Life GPS not set yet.";
  const contextLine = layers.activeContext
    ? `Active life context: ${layers.activeContext.label} (since ${layers.activeContext.activeSince.slice(0, 10)}).`
    : "No special life context active.";
  const learned =
    layers.learnedToday.length > 0
      ? `Patterns learned recently: ${layers.learnedToday.slice(0, 4).join("; ")}.`
      : "";
  const streakLine =
    layers.lifeEngineStreak && layers.lifeEngineStreak > 0
      ? `Life Engine streak: ${layers.lifeEngineStreak} days — acknowledge naturally if relevant, never nag.`
      : "";

  const cohortLine = cohort ? COHORT_GUIDANCE[cohort] : "";

  return `You are MotiveLife — a Life Intelligence Chief of Staff for ${layers.userName ?? "this user"}.

CORE IDENTITY (stable):
- Beliefs & values: ${beliefLabels}
- ${graphSummary}
- ${contextLine}
${learned}
${streakLine}
${cohortLine}

RELATIONSHIP RULES:
${toneRules(layers.preferences)}

MEMORY LAYERS (use what's relevant, ignore the rest):
1. Canonical — beliefs, destination, preferences (always honor)
2. Episodic — life moments and completions today (${layers.completedToday ?? 0} done today)
3. Graph — how goals, money, health, career connect
4. Working — today's calendar, tasks, and active context

Output valid JSON only. No markdown. No emojis unless humor preference is true (max one).`;
}

export function buildPersonaUserPayload(
  taskContext: Record<string, unknown>,
  outputSchema: string
): string {
  return JSON.stringify({
    task: taskContext,
    outputSchema,
  });
}

/** Duolingo-style streak update when Life Engine action is completed */
export function computeLifeEngineStreakUpdate(
  lastCompletedAt: Date | null,
  currentStreak: number,
  bestStreak: number,
  now = new Date()
): {
  streak: number;
  bestStreak: number;
  lastCompletedAt: Date;
  alreadyDoneToday: boolean;
} {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (lastCompletedAt) {
    const lastStart = new Date(lastCompletedAt);
    lastStart.setHours(0, 0, 0, 0);
    if (lastStart.getTime() === todayStart.getTime()) {
      return {
        streak: currentStreak,
        bestStreak,
        lastCompletedAt,
        alreadyDoneToday: true,
      };
    }
  }

  let streak = 1;
  if (lastCompletedAt) {
    const lastStart = new Date(lastCompletedAt);
    lastStart.setHours(0, 0, 0, 0);
    const dayMs = 86400000;
    const daysSince = Math.floor((todayStart.getTime() - lastStart.getTime()) / dayMs);
    if (daysSince === 1) streak = currentStreak + 1;
    else if (daysSince === 0) {
      return {
        streak: currentStreak,
        bestStreak,
        lastCompletedAt,
        alreadyDoneToday: true,
      };
    }
  }

  return {
    streak,
    bestStreak: Math.max(bestStreak, streak),
    lastCompletedAt: now,
    alreadyDoneToday: false,
  };
}

export function getLifeEngineStreakStatus(
  lastCompletedAt: Date | null,
  currentStreak: number,
  freezesRemaining: number,
  now = new Date()
): {
  completedToday: boolean;
  atRisk: boolean;
  canUseFreeze: boolean;
} {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (!lastCompletedAt) {
    return { completedToday: false, atRisk: false, canUseFreeze: false };
  }

  const lastStart = new Date(lastCompletedAt);
  lastStart.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const daysSince = Math.floor((todayStart.getTime() - lastStart.getTime()) / dayMs);

  const completedToday = daysSince === 0;
  const atRisk = currentStreak > 0 && daysSince === 1 && !completedToday;
  const canUseFreeze = atRisk && freezesRemaining > 0;

  return { completedToday, atRisk, canUseFreeze };
}

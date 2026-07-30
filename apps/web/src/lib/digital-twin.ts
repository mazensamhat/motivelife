/** Digital Twin blueprint constants — client-safe */

export const DIGITAL_TWIN_NAME = "Digital Twin";
export const DIGITAL_TWIN_PRODUCT_LINE = "Build My Digital Twin™";

export const DIGITAL_TWIN_ONE_SENTENCE =
  "MyMotiveLife is an AI Life Operating System that builds a living Digital Twin of every user to understand, predict, and improve the trajectory of their life.";

export const DIGITAL_TWIN_MISSION =
  "Most software records your life. Most AI answers your questions. MotiveLife understands where your life is going before you do.";

/** Onboarding prediction-accuracy ladder (blueprint Phase framing) */
export const TWIN_ACCURACY_LADDER = [18, 35, 62, 81, 96] as const;

export const TWIN_ONBOARDING_PHASES = [
  {
    id: "identity",
    title: "Life Identity",
    detail: "Where you live and who you are — taxes, healthcare, and cost of living all start here.",
  },
  {
    id: "career",
    title: "Career Intelligence",
    detail: "Work, income, and hours — so your Twin can model trajectory and burnout risk.",
  },
  {
    id: "finance",
    title: "Financial Intelligence",
    detail: "Cash flow, assets, and liabilities — net worth and retirement models follow.",
  },
  {
    id: "goals",
    title: "Life Goals",
    detail: "What future are you trying to create? Purpose unlocks better guidance.",
  },
  {
    id: "lifestyle",
    title: "Lifestyle Intelligence",
    detail: "Sleep, stress, movement, and routine — energy and habit predictions.",
  },
  {
    id: "personality",
    title: "Personality Intelligence",
    detail: "How you decide — risk, planning style, and motivation.",
  },
  {
    id: "timeline",
    title: "Life Timeline",
    detail: "Major events that explain behavioural shifts over time.",
  },
  {
    id: "connected",
    title: "Connected Life",
    detail: "Calendar, health, and accounts — automation takes over from manual entry.",
  },
] as const;

export const SIX_AI_ENGINES = [
  {
    id: "memory",
    name: "Memory Engine™",
    detail: "Remembers preferences, decisions, patterns, and history — it never forgets.",
  },
  {
    id: "relationship",
    name: "Relationship Engine™",
    detail: "Maps cause and effect across career, money, health, and relationships.",
  },
  {
    id: "signal",
    name: "Signal Engine™",
    detail: "Detects small changes before you notice them.",
  },
  {
    id: "probability",
    name: "Probability Engine™",
    detail: "Every important prediction gets probability, confidence, and a time horizon.",
  },
  {
    id: "simulation",
    name: "Simulation Engine™",
    detail: "What happens if you move, invest more, sleep better, or retire early?",
  },
  {
    id: "explanation",
    name: "Explanation Engine™",
    detail: "Every recommendation answers why — no black box.",
  },
] as const;

export const LIFE_MOMENTUM_DOMAINS = [
  { key: "health" as const, label: "Health", blueprint: "Health" },
  { key: "career" as const, label: "Career", blueprint: "Career" },
  { key: "money" as const, label: "Finances", blueprint: "Finances" },
  { key: "relationships" as const, label: "Relationships", blueprint: "Relationships" },
  { key: "mindset" as const, label: "Mental Energy", blueprint: "Mental Energy" },
  { key: "learning" as const, label: "Future Confidence", blueprint: "Future Confidence" },
] as const;

export function twinAccuracyForStep(step: number, totalSteps: number): number {
  if (totalSteps <= 1) return TWIN_ACCURACY_LADDER[0];
  const t = Math.min(1, Math.max(0, (step - 1) / (totalSteps - 1)));
  const idx = Math.round(t * (TWIN_ACCURACY_LADDER.length - 1));
  return TWIN_ACCURACY_LADDER[idx] ?? TWIN_ACCURACY_LADDER[0];
}

export function momentumTrendLabel(delta: number): string {
  if (delta > 2) return "Trending Up";
  if (delta < -2) return "Declining";
  if (delta > 0) return "Growing";
  if (delta < 0) return "Needs Attention";
  return "Stable";
}

export function domainStatusLabel(score: number, delta: number): string {
  if (score >= 85 && delta >= 0) return "Excellent";
  if (delta > 2) return "Growing";
  if (delta < -2) return "Declining";
  if (score < 55) return "Needs Attention";
  return "Stable";
}

/**
 * Twin completeness heuristic from connected life signals already on the dashboard.
 * Not a medical/financial score — a product confidence cue.
 */
export function estimateTwinConfidence(input: {
  hasFocuses: boolean;
  hasPredictions: boolean;
  hasCommandCenter: boolean;
  hasBeliefs: boolean;
  hasCircle: boolean;
  domainOverall: number;
}): { percent: number; nextHint: string } {
  let percent = 18;
  if (input.hasFocuses) percent += 17;
  if (input.hasPredictions) percent += 15;
  if (input.hasCommandCenter) percent += 12;
  if (input.hasBeliefs) percent += 10;
  if (input.hasCircle) percent += 8;
  percent += Math.round(Math.min(20, input.domainOverall / 5));
  percent = Math.min(96, Math.max(18, percent));

  let nextHint = "Add your life focus to raise Twin confidence.";
  if (!input.hasFocuses) nextHint = "Choose a life focus to start your Digital Twin.";
  else if (!input.hasBeliefs) nextHint = "Share beliefs or preferences in Settings to improve guidance.";
  else if (!input.hasCommandCenter) nextHint = "Connect your calendar so your Twin can see your day.";
  else if (!input.hasCircle) nextHint = "Invite your Life Circle — shared context sharpens predictions.";
  else nextHint = "Keep updating money, health, and goals — every signal improves the Twin.";

  return { percent, nextHint };
}

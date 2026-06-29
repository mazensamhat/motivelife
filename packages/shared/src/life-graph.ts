import type { LifeModuleId } from "./life-os";

/** Stable beliefs — who the user is, not what they did today */
export const LIFE_BELIEF_PRESETS = [
  { id: "family_first", label: "Family first" },
  { id: "health_matters", label: "Health matters" },
  { id: "financial_freedom", label: "Wants financial freedom" },
  { id: "dream_italy", label: "Dreams of moving to Italy" },
  { id: "retire_55", label: "Wants to retire at 55" },
  { id: "flexibility_over_salary", label: "Values flexibility over salary" },
  { id: "introvert", label: "Introvert" },
  { id: "night_owl", label: "Night owl" },
  { id: "build_business", label: "Wants to build a business" },
  { id: "give_back", label: "Wants to give back" },
] as const;

export type LifeBeliefId = (typeof LIFE_BELIEF_PRESETS)[number]["id"];

export interface LifeBelief {
  id: LifeBeliefId | string;
  label: string;
  custom?: boolean;
}

export interface LifePreference {
  reminderStyle: "gentle" | "direct" | "statistics";
  taskLength: "short" | "medium" | "long";
  peakHours: "morning" | "afternoon" | "evening" | "night";
  encouragement: boolean;
  humor: boolean;
  notifications: "minimal" | "normal" | "off";
}

export const DEFAULT_LIFE_PREFERENCES: LifePreference = {
  reminderStyle: "gentle",
  taskLength: "short",
  peakHours: "morning",
  encouragement: true,
  humor: false,
  notifications: "normal",
};

export const LIFE_CONTEXTS = [
  { id: "student", label: "Student", emoji: "🎓" },
  { id: "vacation", label: "Vacation", emoji: "✈️" },
  { id: "new_parent", label: "New Parent", emoji: "👶" },
  { id: "buying_house", label: "Buying a House", emoji: "🏠" },
  { id: "wedding", label: "Wedding", emoji: "💍" },
  { id: "unemployed", label: "Job Search", emoji: "💼" },
  { id: "promotion", label: "Promotion", emoji: "📈" },
  { id: "retirement", label: "Retirement", emoji: "🌅" },
  { id: "starting_business", label: "Starting Business", emoji: "🚀" },
  { id: "moving", label: "Moving", emoji: "📦" },
  { id: "interview", label: "Interview Tomorrow", emoji: "🎯" },
] as const;

export type LifeContextId = (typeof LIFE_CONTEXTS)[number]["id"];

export interface LifeContextState {
  id: LifeContextId;
  label: string;
  activeSince: string;
  expiresAt?: string;
  autoDetected?: boolean;
}

/** When a life context is active, these modules float to the top of Today. */
export const CONTEXT_MODULE_PRIORITIES: Partial<Record<LifeContextId, LifeModuleId[]>> = {
  interview: ["career", "learning", "habits", "health", "money"],
  unemployed: ["career", "learning", "money", "habits", "goals"],
  buying_house: ["money", "career", "goals", "habits", "health"],
  vacation: ["travel", "money", "health", "relationships", "habits"],
  new_parent: ["health", "relationships", "habits", "money", "mindset"],
  wedding: ["money", "relationships", "goals", "health", "career"],
  student: ["learning", "career", "money", "habits", "goals"],
  promotion: ["career", "learning", "health", "relationships", "money"],
  retirement: ["money", "health", "relationships", "habits", "travel"],
  starting_business: ["career", "money", "learning", "goals", "habits"],
  moving: ["money", "health", "relationships", "career", "habits"],
};

export type GraphNodeType =
  | "GOAL"
  | "TASK"
  | "MONEY_ITEM"
  | "HEALTH_ITEM"
  | "LEARNING_ITEM"
  | "APPLICATION"
  | "HABIT"
  | "LIFE_MOMENT"
  | "DESTINATION";

export type GraphRelation = "FUNDS" | "REQUIRES" | "ENABLES" | "TRIGGERS" | "SUPPORTS" | "LINKED_TO";

export interface LifeGraphEdgePayload {
  id: string;
  fromType: GraphNodeType;
  fromId: string;
  toType: GraphNodeType;
  toId: string;
  relation: GraphRelation;
  label: string | null;
}

export interface LifeMomentPayload {
  id: string;
  title: string;
  description: string | null;
  category: string;
  domain: string | null;
  occurredAt: string;
  scoreDelta: number | null;
  permanent: boolean;
}

export interface LifeInsightPayload {
  id: string;
  insight: string;
  category: string;
  date: string;
}

export interface LifeGraphPayload {
  destination: { id: string; label: string } | null;
  nodes: { type: GraphNodeType; id: string; label: string }[];
  edges: LifeGraphEdgePayload[];
}

export interface LifeIntelligencePayload {
  tonightQuestion: string;
  insights: LifeInsightPayload[];
  learnedToday: string[];
}

/** Per-module open tracking for adaptive dashboard */
export interface ModuleUsageEntry {
  lastOpenedAt: string;
  openCount: number;
}

export type ModuleUsageMap = Partial<Record<string, ModuleUsageEntry>>;

/** Life Engine™ — one action from all life inputs */
export interface LifeEngineAction {
  title: string;
  reason: string;
  whyConnected: string;
  domain: string;
  domainSlug: "career" | "money" | "health" | "learning" | "relationships" | "memory" | null;
  actionLabel: string;
  actionHref: string;
  entityId?: string;
  scoreGain: number;
  sources: string[];
}

/** Life Engine™ daily streak (Duolingo-style retention) */
export interface LifeEngineStreakPayload {
  currentStreak: number;
  bestStreak: number;
  freezesRemaining: number;
  completedToday: boolean;
  atRisk: boolean;
  canUseFreeze: boolean;
}

export interface AccountabilityPartner {
  name: string;
  linkedUserId?: string;
}

export interface PartnerActivityPayload {
  name: string;
  currentStreak: number;
  bestStreak: number;
  completedToday: boolean;
  atRisk: boolean;
}

/** Life Replay — annual recap */
export interface LifeReplayHighlight {
  id: string;
  title: string;
  occurredAt: string;
  emoji: string;
}

export interface LifeReplayPayload {
  year: number;
  headline: string;
  subheadline: string;
  isYearEnd: boolean;
  stats: {
    lifeMoments: number;
    goalsCompleted: number;
    tasksCompleted: number;
    scoreStart: number;
    scoreNow: number;
    scoreDelta: number;
    topDomain: string;
  };
  highlights: LifeReplayHighlight[];
  lessons: string[];
}

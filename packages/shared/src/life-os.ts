/** What the user wants MotiveLife to help them improve */
export const LIFE_FOCUS_OPTIONS = [
  { id: "find_job", label: "Find a job", modules: ["career", "learning", "money", "goals"] },
  { id: "get_promoted", label: "Get promoted", modules: ["career", "learning", "goals"] },
  { id: "start_business", label: "Start a business", modules: ["career", "money", "goals", "learning"] },
  { id: "pay_debt", label: "Pay off debt", modules: ["money", "goals", "habits"] },
  { id: "save_house", label: "Save for a house", modules: ["money", "goals", "career"] },
  { id: "budget_better", label: "Budget better", modules: ["money", "habits", "goals"] },
  { id: "build_muscle", label: "Build muscle", modules: ["health", "habits", "goals"] },
  { id: "lose_weight", label: "Lose weight", modules: ["health", "habits", "goals"] },
  { id: "improve_sleep", label: "Improve sleep", modules: ["health", "habits", "mindset"] },
  { id: "reduce_stress", label: "Reduce stress", modules: ["mindset", "health", "habits"] },
  { id: "learn_language", label: "Learn a language", modules: ["learning", "habits", "goals"] },
  { id: "finish_school", label: "Finish school", modules: ["learning", "goals", "career"] },
  { id: "improve_relationship", label: "Improve my relationship", modules: ["relationships", "habits", "mindset"] },
  { id: "be_productive", label: "Become more productive", modules: ["goals", "habits", "career"] },
  { id: "read_more", label: "Read more books", modules: ["learning", "habits"] },
  { id: "travel_more", label: "Travel more", modules: ["travel", "money", "goals"] },
  { id: "plan_retirement", label: "Plan retirement", modules: ["money", "health", "goals"] },
  { id: "something_else", label: "Something else…", modules: ["goals", "habits", "career", "money", "health"] },
] as const;

export type LifeFocusId = (typeof LIFE_FOCUS_OPTIONS)[number]["id"];

export const LIFE_MODULES = [
  { id: "career", label: "Career Module", emoji: "💼", href: "/career" },
  { id: "money", label: "Money Module", emoji: "📈", href: "/money" },
  { id: "health", label: "Health Module", emoji: "❤️", href: "/health" },
  { id: "learning", label: "Learning Module", emoji: "📚", href: "/learning" },
  { id: "relationships", label: "Social & Relationships", emoji: "👥", href: "/relationships" },
  { id: "habits", label: "Habits Module", emoji: "⏰", href: "/habits" },
  { id: "goals", label: "Goals Module", emoji: "🎯", href: "/goals" },
  { id: "mindset", label: "Mindset Module", emoji: "🧠", href: "/health" },
  { id: "travel", label: "Travel Module", emoji: "✈️", href: "/goals" },
] as const;

export type LifeModuleId = (typeof LIFE_MODULES)[number]["id"];

export interface DomainScoreMap {
  career: number;
  money: number;
  health: number;
  learning: number;
  relationships: number;
  mindset: number;
  overall: number;
  overallDelta: number;
  domainDeltas: {
    career: number;
    money: number;
    health: number;
    learning: number;
    relationships: number;
    mindset: number;
  };
}

export type NoticeTone = "positive" | "warning" | "info" | "relationship" | "urgent";

export interface LifeNotice {
  text: string;
  tone: NoticeTone;
  emoji: string;
}

export interface HeroBriefing {
  timeGreeting: string;
  dynamicOpening: string;
  chiefOfStaffLine: string;
  dayAssessment: string;
  challengeLine: string | null;
  goodNews: string;
  estimatedMinutes: number;
  potentialScoreGain: number;
  startAction: {
    label: string;
    href: string;
    taskId?: string;
  };
}

export interface ScoreChangeReason {
  domain: string;
  label: string;
  reason: string;
  delta: number;
}

export interface ModuleCardPayload {
  id: LifeModuleId;
  label: string;
  emoji: string;
  href: string;
  progress: number;
  insight: string;
  actionLabel: string;
  actionHref: string;
  entityId?: string;
  actionTitle: string;
}

export interface LifeTimelineEntry {
  id: string;
  dayLabel: string;
  title: string;
  scoreDelta: number;
}

export interface LifeForecastItem {
  emoji: string;
  label: string;
  eta: string;
}

export interface LifeFeedItem {
  id: string;
  text: string;
  href?: string;
  tone: NoticeTone;
}

export interface LifePredictItem {
  text: string;
  tone: "warning" | "info";
}

export interface DomainNextAction {
  domain: string;
  domainLabel: string;
  title: string;
  reason: string;
  actionLabel: string;
  actionHref: string;
  entityId?: string;
  progress?: number;
}

import type { LifeEngineStreakPayload } from "./life-graph";

export interface CompleteActionResult {
  scoreGain: number;
  message: string;
  timelineTitle: string;
  lifeEngineStreak?: LifeEngineStreakPayload;
  xpGains?: import("./life-xp").LifeXpGain[];
}

export interface AiCoachPrompt {
  prompt: string;
  suggestion: string;
  actionLabel: string;
  actionHref: string;
}

export interface MissionItem {
  id: string;
  title: string;
  domain: string;
  domainLabel: string;
  done: boolean;
  isMission: boolean;
}

export interface MorningOperatingPayload {
  greeting: string;
  focus: string[];
  notices: LifeNotice[];
  insights: string[];
  estimatedMinutes: number;
  potentialScoreGain: number;
  missionBonus: number;
  summary: string | null;
  hero: HeroBriefing;
}

export interface LifeGpsPayload {
  destination: string | null;
  percentComplete: number;
  goalId: string | null;
  subtitle: string;
  etaLabel: string | null;
}

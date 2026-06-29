/** Adaptive Coaching Loops + Track → Understand → Improve module layers */

export type CoachingPhase = "assess" | "plan" | "coach" | "measure" | "adapt";

export type CoachingModule = "money" | "career" | "health" | "learning" | "relationships";

export interface ModuleLayerTrack {
  headline: string;
  detail: string;
  metric?: string;
}

export interface ModuleLayerUnderstand {
  headline: string;
  detail: string;
  insightId: string;
}

export interface ChallengeDay {
  day: number;
  title: string;
  action: string;
  done?: boolean;
}

export interface ModuleLayerImprove {
  headline: string;
  detail: string;
  challengeTitle: string;
  days: ChallengeDay[];
  loopId?: string;
}

export interface ModuleImprovementStack {
  module: CoachingModule;
  track: ModuleLayerTrack;
  understand: ModuleLayerUnderstand;
  improve: ModuleLayerImprove | null;
}

export interface CoachingBlocker {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
}

export interface CoachingLoopPayload {
  id: string;
  module: CoachingModule;
  title: string;
  phase: CoachingPhase;
  goalId: string | null;
  blockers: CoachingBlocker[];
  assessmentSummary: string;
  todayAction: string | null;
  challengeProgress: number;
  adaptations: string[];
  linkedEntityId: string | null;
  nextDay: number;
}

export interface TodayImprovePayload {
  loopId: string;
  module: CoachingModule;
  title: string;
  todayAction: string;
  challengeProgress: number;
  goalTitle: string | null;
  moduleHref: string;
  nextDay: number;
  beliefHook?: string | null;
}

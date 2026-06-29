/** Weekly voice recap — synthesized from captures + practice */

export interface VoiceWeeklyRecap {
  captureCount: number;
  practiceCount: number;
  nightReflectionCount: number;
  avgPracticeScore: number | null;
  topMoods: string[];
  topSignals: string[];
  voiceHighlights: string[];
  practiceHighlights: string[];
  paragraphs: string[];
}

export type VoiceCoachingCommand =
  | "start_career_challenge"
  | "start_money_challenge"
  | "start_health_challenge"
  | "start_learning_challenge"
  | "start_relationships_challenge";

export const VOICE_COACHING_COMMAND_LABELS: Record<VoiceCoachingCommand, string> = {
  start_career_challenge: "Career improvement challenge",
  start_money_challenge: "Money savings challenge",
  start_health_challenge: "Health habit challenge",
  start_learning_challenge: "Learning sprint challenge",
  start_relationships_challenge: "Connection challenge",
};

export const VOICE_COACHING_HREF: Record<VoiceCoachingCommand, string> = {
  start_career_challenge: "/career",
  start_money_challenge: "/money",
  start_health_challenge: "/health",
  start_learning_challenge: "/learning",
  start_relationships_challenge: "/relationships",
};

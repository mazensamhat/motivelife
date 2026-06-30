/** OpenAI usage caps — tuned for MotiveLife Pro ($14.99/mo) on gpt-4o-mini */

export type AiUsageFeature =
  | "voice_organize"
  | "daily_briefing"
  | "evening_review"
  | "weekly_letter";

export type VoiceOrganizeSource =
  | "capture"
  | "brain_dump"
  | "ambient_capture"
  | "night_reflection"
  | "morning_reflection";

/** Pro subscribers: AI voice organizes per calendar month */
export const PLUS_VOICE_ORGANIZE_CAP = 90;

/** Trial: lower cap for the trial period (per month) */
export const TRIAL_VOICE_ORGANIZE_CAP = 30;

/** gpt-4o-mini list pricing (USD per 1M tokens) */
export const OPENAI_MINI_INPUT_PER_M = 0.15;
export const OPENAI_MINI_OUTPUT_PER_M = 0.6;

export interface AiUsageSummary {
  monthKey: string;
  voiceOrganizeUnits: number;
  voiceOrganizeCap: number;
  voiceOrganizeBonus: number;
  voiceOrganizeRemaining: number;
  atVoiceCap: boolean;
  totalCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  byFeature: Record<AiUsageFeature, number>;
}

export function voiceOrganizeWeight(source: VoiceOrganizeSource): number {
  switch (source) {
    case "brain_dump":
      return 3;
    case "ambient_capture":
      return 2;
    default:
      return 1;
  }
}

export function estimateOpenAiCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * OPENAI_MINI_INPUT_PER_M +
    (outputTokens / 1_000_000) * OPENAI_MINI_OUTPUT_PER_M
  );
}

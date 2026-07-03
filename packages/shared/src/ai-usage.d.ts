/** OpenAI usage caps — tuned for MotiveLife Pro ($14.99/mo) on gpt-4o-mini */
export type AiUsageFeature = "voice_organize" | "daily_briefing" | "evening_review" | "weekly_letter";
export type VoiceOrganizeSource = "capture" | "brain_dump" | "ambient_capture" | "night_reflection" | "morning_reflection";
/** Pro subscribers: AI voice organizes per calendar month */
export declare const PLUS_VOICE_ORGANIZE_CAP = 90;
/** Trial: lower cap for the trial period (per month) */
export declare const TRIAL_VOICE_ORGANIZE_CAP = 30;
/** gpt-4o-mini list pricing (USD per 1M tokens) */
export declare const OPENAI_MINI_INPUT_PER_M = 0.15;
export declare const OPENAI_MINI_OUTPUT_PER_M = 0.6;
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
export declare function voiceOrganizeWeight(source: VoiceOrganizeSource): number;
export declare function estimateOpenAiCostUsd(inputTokens: number, outputTokens: number): number;

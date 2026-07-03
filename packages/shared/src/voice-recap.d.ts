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
export type VoiceCoachingCommand = "start_career_challenge" | "start_money_challenge" | "start_health_challenge" | "start_learning_challenge" | "start_relationships_challenge";
export declare const VOICE_COACHING_COMMAND_LABELS: Record<VoiceCoachingCommand, string>;
export declare const VOICE_COACHING_HREF: Record<VoiceCoachingCommand, string>;

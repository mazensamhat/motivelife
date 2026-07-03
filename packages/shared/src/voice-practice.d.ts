/** Voice practice — career, relationships, leadership */
export type VoicePracticeDomain = "career" | "relationships" | "leadership";
export type CareerPracticeMode = "interview" | "negotiation" | "presentation" | "conversation";
export type RelationshipPracticeMode = "date_intro" | "difficult_talk" | "reconnection" | "appreciation";
export type LeadershipPracticeMode = "parenting_moment" | "team_feedback" | "hard_decision" | "motivate_team";
export type VoicePracticeMode = CareerPracticeMode | RelationshipPracticeMode | LeadershipPracticeMode;
export interface VoicePracticeScores {
    overall: number;
    confidence: number;
    clarity: number;
    energy: number;
    fillerWords: number;
    wordsPerMinute: number;
    fillerRate: number;
}
export interface VoicePracticeTip {
    category: "confidence" | "clarity" | "energy" | "fillers" | "structure" | "warmth";
    text: string;
}
export interface VoicePracticePayload {
    id: string;
    domain: VoicePracticeDomain;
    mode: VoicePracticeMode;
    prompt: string;
    transcript: string;
    durationSeconds: number;
    scores: VoicePracticeScores;
    tips: VoicePracticeTip[];
    coachNote: string;
    createdAt: string;
}
export declare const VOICE_PRACTICE_MODE_LABELS: Record<VoicePracticeMode, string>;
export declare const VOICE_PRACTICE_MODES_BY_DOMAIN: Record<VoicePracticeDomain, VoicePracticeMode[]>;
export declare const VOICE_PRACTICE_DOMAIN_META: Record<VoicePracticeDomain, {
    title: string;
    description: string;
    defaultMode: VoicePracticeMode;
}>;
export declare const VOICE_PRACTICE_PROMPTS: Record<VoicePracticeMode, string[]>;
export declare function practiceDomainForMode(mode: VoicePracticeMode): VoicePracticeDomain;
export declare function pickPracticePrompt(mode: VoicePracticeMode, seed?: number): string;

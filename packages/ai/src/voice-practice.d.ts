import type { VoicePracticeMode, VoicePracticeScores, VoicePracticeTip } from "@forward/shared";
export { VOICE_PRACTICE_PROMPTS, pickPracticePrompt } from "@forward/shared";
export declare function scoreVoicePractice(transcript: string, mode: VoicePracticeMode, durationSeconds: number): {
    scores: VoicePracticeScores;
    tips: VoicePracticeTip[];
    coachNote: string;
};

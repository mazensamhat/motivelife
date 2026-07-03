import type { VoiceCapturePlan } from "@forward/shared";
import { type OpenAiUsage } from "./openai-usage";
export type { OpenAiUsage } from "./openai-usage";
export { parseOpenAiUsage } from "./openai-usage";
/** Rule-based voice capture when OpenAI is off — still creates memories and routes modules */
export declare function parseVoiceCaptureRules(transcript: string): VoiceCapturePlan;
export declare function parseNightReflectionRules(transcript: string): VoiceCapturePlan;
export declare function parseMorningReflectionRules(transcript: string, ctx: {
    yesterdayMood?: string | null;
    yesterdaySummary?: string | null;
}): VoiceCapturePlan;
/** Long-form brain dump — batch extract every thread mentioned */
export declare function parseBrainDumpRules(transcript: string): VoiceCapturePlan;
export interface VoiceCaptureAiContext {
    userName: string | null;
    recentMemories?: string[];
    activeGoals?: string[];
    yesterdayMood?: string | null;
    yesterdaySummary?: string | null;
}
/** Passive ambient capture — each pause-delimited segment becomes its own thread */
export declare function parseAmbientCaptureRules(transcript: string, segments?: string[]): VoiceCapturePlan;
export declare function parseVoiceCaptureBySource(transcript: string, source: "capture" | "brain_dump" | "ambient_capture" | "night_reflection" | "morning_reflection", context: VoiceCaptureAiContext, apiKey?: string | null, segments?: string[]): Promise<{
    plan: VoiceCapturePlan;
    usage: OpenAiUsage | null;
}>;
export declare function parseVoiceCaptureWithAI(transcript: string, context: VoiceCaptureAiContext, apiKey: string, source?: "capture" | "brain_dump" | "ambient_capture" | "night_reflection" | "morning_reflection"): Promise<VoiceCapturePlan>;
export declare function searchVoiceCaptures(captures: {
    transcript: string;
    summary: string | null;
    createdAt: Date;
}[], query: string): {
    transcript: string;
    summary: string | null;
    createdAt: Date;
    snippet: string;
}[];

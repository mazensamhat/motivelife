import type { LifeBelief, LifeContextState, LifeGraphPayload, LifePreference } from "@forward/shared";
export type GenerationCohort = "gen_z" | "millennial" | "gen_x" | "boomer";
export interface PersonaLayers {
    userName: string | null;
    birthYear?: number | null;
    beliefs: LifeBelief[];
    preferences: LifePreference;
    activeContext: LifeContextState | null;
    lifeDestination: string | null;
    graph: LifeGraphPayload | null;
    learnedToday: string[];
    lifeEngineStreak?: number;
    completedToday?: number;
}
export declare function getGenerationCohort(birthYear?: number | null): GenerationCohort | null;
export declare function buildPersonaSystemPrompt(layers: PersonaLayers): string;
export declare function buildPersonaUserPayload(taskContext: Record<string, unknown>, outputSchema: string): string;
/** Duolingo-style streak update when Life Engine action is completed */
export declare function computeLifeEngineStreakUpdate(lastCompletedAt: Date | null, currentStreak: number, bestStreak: number, now?: Date): {
    streak: number;
    bestStreak: number;
    lastCompletedAt: Date;
    alreadyDoneToday: boolean;
};
export declare function getLifeEngineStreakStatus(lastCompletedAt: Date | null, currentStreak: number, freezesRemaining: number, now?: Date): {
    completedToday: boolean;
    atRisk: boolean;
    canUseFreeze: boolean;
};

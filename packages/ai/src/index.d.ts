import type { BriefingPayload, EveningReviewPayload, WeeklyReviewPayload, MonthlyReviewPayload, QuarterlyReviewPayload, PrepChecklistItem, LifeBelief, LifeContextState, LifePreference } from "@forward/shared";
import type { AgentType } from "@forward/shared";
import { type OpenAiUsage } from "./openai-usage";
import { type PersonaLayers } from "./persona-prompt";
export { buildPersonaSystemPrompt, buildPersonaUserPayload, computeLifeEngineStreakUpdate, getLifeEngineStreakStatus, getGenerationCohort, type PersonaLayers, type GenerationCohort, } from "./persona-prompt";
export interface GoalContext {
    id: string;
    title: string;
    domain: string;
    progress: number;
    status: string;
}
export interface TaskContext {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    isMission: boolean;
    goalTitle?: string;
}
export interface BriefingContext {
    userName: string | null;
    goals: GoalContext[];
    tasks: TaskContext[];
    overdueTasks: TaskContext[];
    missionTask: TaskContext | null;
    calendarEvents?: CalendarEventBrief[];
    /** Layered persona — beliefs, prefs, graph, context for LLM */
    persona?: PersonaLayers;
}
export interface CalendarEventBrief {
    title: string;
    start: Date;
    hoursUntil: number;
}
/** Rule-based briefing when no LLM key is configured */
export declare function generateBriefing(context: BriefingContext): BriefingPayload;
export interface SuggestionContext {
    goals: GoalContext[];
    tasks: TaskContext[];
    staleGoals: GoalContext[];
    applications?: ApplicationContext[];
    moneyItems?: MoneyItemContext[];
    calendarEvents?: CalendarEventBrief[];
    habits?: HabitContext[];
    healthItems?: HealthItemContext[];
    learningItems?: LearningItemContext[];
    emails?: EmailContext[];
    memories?: {
        id: string;
        title: string;
        content: string;
    }[];
}
export interface EmailContext {
    id: string;
    subject: string;
    from: string;
    snippet: string;
    isUnread: boolean;
}
export interface MoneyItemContext {
    id: string;
    type: string;
    title: string;
    targetAmount: number | null;
    currentAmount: number;
    dueDay: number | null;
    targetDate: Date | null;
    daysUntilDue: number | null;
    monthlyNeeded: number | null;
    percentComplete: number | null;
}
export interface ApplicationContext {
    id: string;
    company: string;
    role: string;
    status: string;
    appliedAt: Date | null;
    interviewAt: Date | null;
    daysSinceUpdate: number;
    nextStep: string | null;
}
export interface HabitContext {
    id: string;
    title: string;
    frequency: string;
    streak: number;
    doneToday: boolean;
    daysSinceLastDone: number | null;
}
export interface HealthItemContext {
    id: string;
    type: string;
    title: string;
    targetValue: number | null;
    currentValue: number;
    unit: string | null;
    percentComplete: number | null;
}
export interface LearningItemContext {
    id: string;
    type: string;
    title: string;
    progress: number;
    targetDate: Date | null;
    daysUntilTarget: number | null;
    daysSinceUpdate: number;
}
export interface Suggestion {
    agent: AgentType;
    title: string;
    reason: string;
    actionLabel?: string;
    actionHref?: string;
    entityId?: string;
}
/** Collect suggestions, optionally filtered to one agent */
export declare function collectSuggestions(context: SuggestionContext, options?: {
    agent?: AgentType;
    limit?: number;
}): Suggestion[];
/** Proactive suggestions — Level 1 (Suggest) per Intervention Framework */
export declare function generateSuggestions(context: SuggestionContext): Suggestion[];
export declare function getBestSuggestionForAgent(context: SuggestionContext, agent: AgentType): Suggestion | null;
export declare function getDomainNextActionFromContext(context: SuggestionContext, agent: AgentType, domainLabel: string): {
    domain: "TASK" | "CAREER" | "MONEY" | "HEALTH" | "LEARNING" | "TRAVEL" | "CALENDAR" | "GENERAL";
    domainLabel: string;
    title: string;
    reason: string;
    actionLabel: string;
    actionHref: string;
    entityId: string | undefined;
};
export declare function habitDoneToday(lastDoneAt: Date | null, now?: Date): boolean;
export declare function habitDaysSinceLastDone(lastDoneAt: Date | null, now?: Date): number | null;
export declare function computeHabitCheckIn(lastDoneAt: Date | null, frequency: "DAILY" | "WEEKLY", currentStreak: number, bestStreak: number, now?: Date): {
    streak: number;
    bestStreak: number;
    lastDoneAt: Date;
    alreadyDone: boolean;
};
export declare function buildHealthItemContext(item: {
    id: string;
    type: string;
    title: string;
    targetValue: number | null;
    currentValue: number;
    unit: string | null;
}): HealthItemContext;
export declare function buildLearningItemContext(item: {
    id: string;
    type: string;
    title: string;
    progress: number;
    targetDate: Date | null;
    updatedAt: Date;
}): LearningItemContext;
/** Compute money item context for Money Agent suggestions */
export declare function buildMoneyItemContext(item: {
    id: string;
    type: string;
    title: string;
    targetAmount: number | null;
    currentAmount: number;
    dueDay: number | null;
    targetDate: Date | null;
}): MoneyItemContext;
/** Optional LLM-enhanced briefing when OPENAI_API_KEY is set */
export declare function generateBriefingWithAI(context: BriefingContext, apiKey: string): Promise<{
    briefing: BriefingPayload;
    usage: OpenAiUsage | null;
}>;
export interface EveningReviewContext {
    userName: string | null;
    completedToday: TaskContext[];
    pendingTasks: TaskContext[];
    missionCompleted: boolean;
    activeGoals: GoalContext[];
    lifeEngineStreak?: number;
    lifeXpToday?: number;
    persona?: PersonaLayers;
}
/** Rule-based evening review */
export declare function generateEveningReview(context: EveningReviewContext): EveningReviewPayload;
/** Optional LLM evening wrap-up — one cached call per user per evening */
export declare function generateEveningReviewWithAI(context: EveningReviewContext, apiKey: string): Promise<{
    review: EveningReviewPayload;
    usage: OpenAiUsage | null;
}>;
export interface WeeklyReviewContext {
    userName: string | null;
    tasksCompleted: number;
    activeGoals: GoalContext[];
    momentsThisWeek: {
        title: string;
    }[];
    pendingTasks: TaskContext[];
    goalsCompletedThisWeek?: number;
    avgGoalProgress?: number;
    preferences?: LifePreference;
    beliefs?: LifeBelief[];
    lifeEngineStreak?: number;
    lifeXpGainedThisWeek?: number;
    coachingDaysCompleted?: number;
    topXpDimensionLabel?: string | null;
    persona?: PersonaLayers;
    voiceRecap?: {
        captureCount: number;
        practiceCount: number;
        avgPracticeScore: number | null;
        voiceHighlights: string[];
        practiceHighlights: string[];
        topMoods: string[];
    } | null;
}
export declare function generateWeeklyReview(context: WeeklyReviewContext): WeeklyReviewPayload;
export declare function generateWeeklyReviewWithAI(context: WeeklyReviewContext, apiKey: string): Promise<{
    review: WeeklyReviewPayload;
    usage: OpenAiUsage | null;
}>;
export interface MonthlyReviewContext {
    userName: string | null;
    tasksCompleted: number;
    goalsCompleted: number;
    activeGoals: GoalContext[];
    completedGoals: GoalContext[];
    staleGoals: GoalContext[];
    momentsThisMonth: {
        title: string;
        domain: string | null;
    }[];
}
export declare function generateMonthlyReview(context: MonthlyReviewContext): MonthlyReviewPayload;
export interface QuarterlyReviewContext {
    userName: string | null;
    tasksCompleted: number;
    goalsCompleted: number;
    activeGoals: GoalContext[];
    completedGoals: GoalContext[];
    neglectedDomains: string[];
    topHabitStreaks: {
        title: string;
        streak: number;
    }[];
    momentsThisQuarter: {
        title: string;
        domain: string | null;
    }[];
}
export declare function generateQuarterlyReview(context: QuarterlyReviewContext): QuarterlyReviewPayload;
export type NoticeTone = "positive" | "warning" | "info" | "relationship" | "urgent";
export interface LifeNotice {
    text: string;
    tone: NoticeTone;
    emoji: string;
}
export interface LifeNoticesContext {
    userName: string | null;
    habits: {
        title: string;
        lastDoneAt: Date | null;
        streak: number;
    }[];
    moneyItems: {
        title: string;
        type: string;
        dueDay: number | null;
        targetDate: Date | null;
    }[];
    applications: {
        company: string;
        status: string;
        updatedAt: Date;
    }[];
    staleGoalCount: number;
    completedToday: number;
    sleepHabitStreak?: number;
    beliefs?: LifeBelief[];
    preferences?: LifePreference;
    activeContext?: LifeContextState | null;
}
export declare function generateLifeNotices(ctx: LifeNoticesContext): LifeNotice[];
export interface HeroBriefingContext {
    userName: string | null;
    hour: number;
    completedToday: number;
    pendingMission: {
        title: string;
        domain: string;
        id: string;
    }[];
    domainScores: {
        career: number;
        overall: number;
        domainDeltas: Record<string, number>;
    };
    lifeGps: {
        destination: string | null;
        percentComplete: number;
        etaLabel: string | null;
    };
    careerProgressToday: boolean;
    beliefs?: LifeBelief[];
    preferences?: LifePreference;
    activeContext?: LifeContextState | null;
}
export declare function generateHeroBriefing(ctx: HeroBriefingContext): {
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
        taskId: string;
    } | {
        label: string;
        href: string;
        taskId?: undefined;
    };
};
export declare function generateScoreChangeReasons(scores: {
    domainDeltas: Record<string, number>;
    career: number;
    money: number;
    health: number;
    learning: number;
    relationships: number;
    mindset: number;
}, completedToday: number): {
    domain: string;
    label: string;
    reason: string;
    delta: number;
}[];
export declare function generateLifePredictions(ctx: {
    savingsProgress: number;
    savingsTarget: number | null;
    workoutStreak: number;
    calendarBusyNextWeek: boolean;
    month: number;
}): {
    text: string;
    tone: "warning" | "info";
}[];
export declare function decomposeGoal(goal: {
    title: string;
    domain: string;
    description?: string | null;
}): string[];
export declare function defaultInterviewPrep(company: string, role: string): PrepChecklistItem[];
export declare function parsePrepChecklist(json: string | null, company: string, role: string): PrepChecklistItem[];
export declare function interviewPrepProgress(items: PrepChecklistItem[]): number;
export declare function generateInterviewSuggestions(company: string, role: string, items: PrepChecklistItem[], interviewAt: Date | null): string[];
export { parseVoiceCaptureRules, parseVoiceCaptureWithAI, parseVoiceCaptureBySource, parseNightReflectionRules, parseMorningReflectionRules, parseBrainDumpRules, parseAmbientCaptureRules, searchVoiceCaptures, type VoiceCaptureAiContext, } from "./voice-capture";
export { scoreVoicePractice, pickPracticePrompt, VOICE_PRACTICE_PROMPTS, } from "./voice-practice";
export { parseOpenAiUsage, type OpenAiUsage, } from "./openai-usage";
export { detectVoiceCoachingCommands, VOICE_COMMAND_EXAMPLES, } from "./voice-commands";

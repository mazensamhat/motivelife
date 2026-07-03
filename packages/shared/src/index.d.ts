export declare const LIFE_DOMAINS: readonly ["CAREER", "MONEY", "HEALTH", "PROJECTS", "HABITS", "LEARNING", "RELATIONSHIPS", "TRAVEL", "BUSINESS", "DREAMS"];
export type LifeDomain = (typeof LIFE_DOMAINS)[number];
export declare const DOMAIN_LABELS: Record<LifeDomain, string>;
export declare const AGENT_TYPES: readonly ["CAREER", "MONEY", "CALENDAR", "TASK", "HEALTH", "LEARNING", "TRAVEL", "GENERAL"];
export type AgentType = (typeof AGENT_TYPES)[number];
export declare const AGENT_LABELS: Record<AgentType, string>;
export interface BriefingHeroLines {
    dynamicOpening?: string;
    chiefOfStaffLine?: string;
    challengeLine?: string | null;
    goodNews?: string;
}
export interface BriefingPayload {
    priorities: string[];
    mission: string | null;
    suggestedAction: string | null;
    summary: string;
    /** LLM-generated hero copy merged into Today hero briefing */
    hero?: BriefingHeroLines;
    /** LLM-generated coach chip copy */
    coach?: {
        prompt: string;
        suggestion: string;
    };
}
export interface EveningReviewPayload {
    completedCount: number;
    completedTasks: string[];
    highlight: string | null;
    carryForward: string | null;
    summary: string;
}
export interface WeeklyReviewPayload {
    tasksCompleted: number;
    wins: string[];
    focusAreas: string[];
    goalsSummary: string | null;
    summary: string;
    letterParagraphs: string[];
}
export interface WeekProgressStats {
    tasksCompleted: number;
    lifeXpGained: number;
    coachingDaysCompleted: number;
    lifeEngineStreak: number;
    topXpDimension: {
        id: string;
        label: string;
        amount: number;
    } | null;
}
export interface MonthlyReviewPayload {
    tasksCompleted: number;
    goalsCompleted: number;
    wins: string[];
    adjustments: string[];
    domainSummary: string | null;
    summary: string;
}
export interface QuarterlyReviewPayload {
    tasksCompleted: number;
    goalsCompleted: number;
    wins: string[];
    priorities: string[];
    domainSummary: string | null;
    summary: string;
}
export interface CalendarEventContext {
    title: string;
    start: Date;
    hoursUntil: number;
}
export interface PrepChecklistItem {
    id: string;
    label: string;
    done: boolean;
}
export interface CreateGoalInput {
    title: string;
    description?: string;
    domain: LifeDomain;
    targetDate?: string;
}
export interface CreateTaskInput {
    title: string;
    description?: string;
    goalId?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate?: string;
    isMission?: boolean;
}
export declare const APPLICATION_STATUSES: readonly ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export declare const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string>;
export interface CreateApplicationInput {
    company: string;
    role: string;
    goalId?: string;
    status?: ApplicationStatus;
    url?: string;
    notes?: string;
    nextStep?: string;
}
export declare const MONEY_ITEM_TYPES: readonly ["SAVINGS", "DEBT", "BILL"];
export type MoneyItemType = (typeof MONEY_ITEM_TYPES)[number];
export declare const MONEY_TYPE_LABELS: Record<MoneyItemType, string>;
export interface CreateMoneyItemInput {
    type: MoneyItemType;
    title: string;
    targetAmount?: number;
    currentAmount?: number;
    dueDay?: number;
    targetDate?: string;
    goalId?: string;
    notes?: string;
}
export declare const HABIT_FREQUENCIES: readonly ["DAILY", "WEEKLY"];
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];
export declare const HABIT_FREQUENCY_LABELS: Record<HabitFrequency, string>;
export declare const HEALTH_ITEM_TYPES: readonly ["SLEEP", "FITNESS", "NUTRITION", "WELLNESS"];
export type HealthItemType = (typeof HEALTH_ITEM_TYPES)[number];
export declare const HEALTH_TYPE_LABELS: Record<HealthItemType, string>;
export declare const LEARNING_ITEM_TYPES: readonly ["COURSE", "BOOK", "SKILL"];
export type LearningItemType = (typeof LEARNING_ITEM_TYPES)[number];
export declare const LEARNING_TYPE_LABELS: Record<LearningItemType, string>;
export declare const RELATIONSHIP_ITEM_TYPES: readonly ["FAMILY", "FRIEND", "PARTNER", "COMMUNITY"];
export type RelationshipItemType = (typeof RELATIONSHIP_ITEM_TYPES)[number];
export declare const RELATIONSHIP_TYPE_LABELS: Record<RelationshipItemType, string>;
export * from "./life-os";
export * from "./life-graph";
export * from "./life-xp";
export * from "./coaching-loop";
export * from "./voice-capture";
export * from "./voice-practice";
export * from "./voice-recap";
export * from "./ai-usage";

export declare const LIFE_FOCUS_OPTIONS: readonly [{
    readonly id: "find_job";
    readonly label: "Find a job";
    readonly modules: readonly ["career", "learning", "money", "goals"];
}, {
    readonly id: "get_promoted";
    readonly label: "Get promoted";
    readonly modules: readonly ["career", "learning", "goals"];
}, {
    readonly id: "start_business";
    readonly label: "Start a business";
    readonly modules: readonly ["career", "money", "goals", "learning"];
}, {
    readonly id: "pay_debt";
    readonly label: "Pay off debt";
    readonly modules: readonly ["money", "goals", "habits"];
}, {
    readonly id: "save_house";
    readonly label: "Save for a house";
    readonly modules: readonly ["money", "goals", "career"];
}, {
    readonly id: "budget_better";
    readonly label: "Budget better";
    readonly modules: readonly ["money", "habits", "goals"];
}, {
    readonly id: "build_muscle";
    readonly label: "Build muscle";
    readonly modules: readonly ["health", "habits", "goals"];
}, {
    readonly id: "lose_weight";
    readonly label: "Lose weight";
    readonly modules: readonly ["health", "habits", "goals"];
}, {
    readonly id: "improve_sleep";
    readonly label: "Improve sleep";
    readonly modules: readonly ["health", "habits", "mindset"];
}, {
    readonly id: "reduce_stress";
    readonly label: "Reduce stress";
    readonly modules: readonly ["mindset", "health", "habits"];
}, {
    readonly id: "learn_language";
    readonly label: "Learn a language";
    readonly modules: readonly ["learning", "habits", "goals"];
}, {
    readonly id: "finish_school";
    readonly label: "Finish school";
    readonly modules: readonly ["learning", "goals", "career"];
}, {
    readonly id: "improve_relationship";
    readonly label: "Improve my relationship";
    readonly modules: readonly ["relationships", "habits", "mindset"];
}, {
    readonly id: "be_productive";
    readonly label: "Become more productive";
    readonly modules: readonly ["goals", "habits", "career"];
}, {
    readonly id: "read_more";
    readonly label: "Read more books";
    readonly modules: readonly ["learning", "habits"];
}, {
    readonly id: "travel_more";
    readonly label: "Travel more";
    readonly modules: readonly ["travel", "money", "goals"];
}, {
    readonly id: "plan_retirement";
    readonly label: "Plan retirement";
    readonly modules: readonly ["money", "health", "goals"];
}, {
    readonly id: "something_else";
    readonly label: "Something else…";
    readonly modules: readonly ["goals", "habits", "career", "money", "health"];
}];
export type LifeFocusId = (typeof LIFE_FOCUS_OPTIONS)[number]["id"];
export declare const LIFE_MODULES: readonly [{
    readonly id: "career";
    readonly label: "Career Module";
    readonly emoji: "💼";
    readonly href: "/career";
}, {
    readonly id: "money";
    readonly label: "Kashu";
    readonly emoji: "📈";
    readonly href: "/kashu";
}, {
    readonly id: "health";
    readonly label: "Health Module";
    readonly emoji: "❤️";
    readonly href: "/health";
}, {
    readonly id: "learning";
    readonly label: "Learning Module";
    readonly emoji: "📚";
    readonly href: "/learning";
}, {
    readonly id: "relationships";
    readonly label: "Social & Relationships";
    readonly emoji: "👥";
    readonly href: "/relationships";
}, {
    readonly id: "family";
    readonly label: "Family Map";
    readonly emoji: "🗺️";
    readonly href: "/family-map";
}, {
    readonly id: "habits";
    readonly label: "Habits Module";
    readonly emoji: "⏰";
    readonly href: "/habits";
}, {
    readonly id: "goals";
    readonly label: "UPLIFT";
    readonly emoji: "🎯";
    readonly href: "/goals";
}, {
    readonly id: "mindset";
    readonly label: "Mindset Module";
    readonly emoji: "🧠";
    readonly href: "/health";
}, {
    readonly id: "travel";
    readonly label: "Travel Module";
    readonly emoji: "✈️";
    readonly href: "/goals";
}];
export type LifeModuleId = (typeof LIFE_MODULES)[number]["id"];
/** First-time onboarding — pick one problem to fix first */
export declare const ONBOARDING_PRIORITY_OPTIONS: readonly [{
    readonly id: "money";
    readonly label: "Money & bills";
    readonly emoji: "💰";
    readonly focusIds: LifeFocusId[];
    readonly modules: LifeModuleId[];
}, {
    readonly id: "health";
    readonly label: "Health & energy";
    readonly emoji: "❤️";
    readonly focusIds: LifeFocusId[];
    readonly modules: LifeModuleId[];
}, {
    readonly id: "career";
    readonly label: "Career & income";
    readonly emoji: "💼";
    readonly focusIds: LifeFocusId[];
    readonly modules: LifeModuleId[];
}, {
    readonly id: "relationship";
    readonly label: "Relationships";
    readonly emoji: "👥";
    readonly focusIds: LifeFocusId[];
    readonly modules: LifeModuleId[];
}, {
    readonly id: "discipline";
    readonly label: "Discipline & habits";
    readonly emoji: "⏰";
    readonly focusIds: LifeFocusId[];
    readonly modules: LifeModuleId[];
}, {
    readonly id: "stress";
    readonly label: "Stress & balance";
    readonly emoji: "🧘";
    readonly focusIds: LifeFocusId[];
    readonly modules: LifeModuleId[];
}, {
    readonly id: "future";
    readonly label: "Future planning";
    readonly emoji: "🎯";
    readonly focusIds: LifeFocusId[];
    readonly modules: LifeModuleId[];
}];
export type OnboardingPriorityId = (typeof ONBOARDING_PRIORITY_OPTIONS)[number]["id"];
export interface DomainScoreMap {
    career: number;
    money: number;
    health: number;
    learning: number;
    relationships: number;
    mindset: number;
    overall: number;
    overallDelta: number;
    domainDeltas: {
        career: number;
        money: number;
        health: number;
        learning: number;
        relationships: number;
        mindset: number;
    };
}
export type NoticeTone = "positive" | "warning" | "info" | "relationship" | "urgent";
export interface LifeNotice {
    text: string;
    tone: NoticeTone;
    emoji: string;
}
export interface BriefingInsight {
    domain: "Career" | "Money" | "Health";
    text: string;
}
export interface LifeMemoryHighlight {
    id: string;
    text: string;
    source: "memory" | "voice";
    href: string;
}
export interface HeroBriefing {
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
        taskId?: string;
    };
    closingLine?: string | null;
}
export interface ScoreChangeReason {
    domain: string;
    label: string;
    reason: string;
    delta: number;
}
export interface ModuleCardPayload {
    id: LifeModuleId;
    label: string;
    emoji: string;
    href: string;
    progress: number;
    insight: string;
    actionLabel: string;
    actionHref: string;
    entityId?: string;
    actionTitle: string;
}
export interface LifeTimelineEntry {
    id: string;
    dayLabel: string;
    title: string;
    scoreDelta: number;
}
export interface LifeForecastItem {
    emoji: string;
    label: string;
    eta: string;
}
export interface LifeFeedItem {
    id: string;
    text: string;
    href?: string;
    tone: NoticeTone;
}
export interface LifePredictItem {
    id: string;
    text: string;
    tone: "warning" | "info" | "positive" | "urgent";
    category: "deadline" | "money" | "health" | "career" | "calendar" | "relationship" | "general";
    confidence?: number;
    href?: string;
    subtitle?: string;
}
export interface DomainNextAction {
    domain: string;
    domainLabel: string;
    title: string;
    reason: string;
    actionLabel: string;
    actionHref: string;
    entityId?: string;
    progress?: number;
    estimatedMinutes?: number;
    scoreReward?: number;
}
import type { LifeEngineStreakPayload } from "./life-graph";
export interface CompleteActionResult {
    scoreGain: number;
    message: string;
    timelineTitle: string;
    lifeEngineStreak?: LifeEngineStreakPayload;
    xpGains?: import("./life-xp").LifeXpGain[];
}
export interface AiCoachPrompt {
    /** Headline observation — what the coach noticed */
    observation: string;
    prompt: string;
    suggestion: string;
    actionLabel: string;
    actionHref: string;
    domain?: string;
    estimatedMinutes?: number;
    scoreReward?: number;
    yesLabel?: string;
}
export interface MissionItem {
    id: string;
    title: string;
    domain: string;
    domainLabel: string;
    done: boolean;
    isMission: boolean;
}
export interface MorningOperatingPayload {
    greeting: string;
    focus: string[];
    notices: LifeNotice[];
    insights: string[];
    briefingInsights: BriefingInsight[];
    estimatedMinutes: number;
    potentialScoreGain: number;
    missionBonus: number;
    summary: string | null;
    hero: HeroBriefing;
}
export interface LifeGpsPayload {
    destination: string | null;
    percentComplete: number;
    goalId: string | null;
    subtitle: string;
    etaLabel: string | null;
}

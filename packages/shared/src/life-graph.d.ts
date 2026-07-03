import type { LifeModuleId } from "./life-os";
/** Stable beliefs — who the user is, not what they did today */
export declare const LIFE_BELIEF_PRESETS: readonly [{
    readonly id: "family_first";
    readonly label: "Family first";
}, {
    readonly id: "health_matters";
    readonly label: "Health matters";
}, {
    readonly id: "financial_freedom";
    readonly label: "Wants financial freedom";
}, {
    readonly id: "dream_italy";
    readonly label: "Dreams of moving to Italy";
}, {
    readonly id: "retire_55";
    readonly label: "Wants to retire at 55";
}, {
    readonly id: "flexibility_over_salary";
    readonly label: "Values flexibility over salary";
}, {
    readonly id: "introvert";
    readonly label: "Introvert";
}, {
    readonly id: "night_owl";
    readonly label: "Night owl";
}, {
    readonly id: "build_business";
    readonly label: "Wants to build a business";
}, {
    readonly id: "give_back";
    readonly label: "Wants to give back";
}];
export type LifeBeliefId = (typeof LIFE_BELIEF_PRESETS)[number]["id"];
export interface LifeBelief {
    id: LifeBeliefId | string;
    label: string;
    custom?: boolean;
}
export interface LifePreference {
    reminderStyle: "gentle" | "direct" | "statistics";
    taskLength: "short" | "medium" | "long";
    peakHours: "morning" | "afternoon" | "evening" | "night";
    encouragement: boolean;
    humor: boolean;
    notifications: "minimal" | "normal" | "off";
}
export declare const DEFAULT_LIFE_PREFERENCES: LifePreference;
export declare const LIFE_CONTEXTS: readonly [{
    readonly id: "student";
    readonly label: "Student";
    readonly emoji: "🎓";
}, {
    readonly id: "vacation";
    readonly label: "Vacation";
    readonly emoji: "✈️";
}, {
    readonly id: "new_parent";
    readonly label: "New Parent";
    readonly emoji: "👶";
}, {
    readonly id: "buying_house";
    readonly label: "Buying a House";
    readonly emoji: "🏠";
}, {
    readonly id: "wedding";
    readonly label: "Wedding";
    readonly emoji: "💍";
}, {
    readonly id: "unemployed";
    readonly label: "Job Search";
    readonly emoji: "💼";
}, {
    readonly id: "promotion";
    readonly label: "Promotion";
    readonly emoji: "📈";
}, {
    readonly id: "retirement";
    readonly label: "Retirement";
    readonly emoji: "🌅";
}, {
    readonly id: "starting_business";
    readonly label: "Starting Business";
    readonly emoji: "🚀";
}, {
    readonly id: "moving";
    readonly label: "Moving";
    readonly emoji: "📦";
}, {
    readonly id: "interview";
    readonly label: "Interview Tomorrow";
    readonly emoji: "🎯";
}];
export type LifeContextId = (typeof LIFE_CONTEXTS)[number]["id"];
export interface LifeContextState {
    id: LifeContextId;
    label: string;
    activeSince: string;
    expiresAt?: string;
    autoDetected?: boolean;
}
/** When a life context is active, these modules float to the top of Today. */
export declare const CONTEXT_MODULE_PRIORITIES: Partial<Record<LifeContextId, LifeModuleId[]>>;
export type GraphNodeType = "GOAL" | "TASK" | "MONEY_ITEM" | "HEALTH_ITEM" | "LEARNING_ITEM" | "APPLICATION" | "HABIT" | "LIFE_MOMENT" | "DESTINATION";
export type GraphRelation = "FUNDS" | "REQUIRES" | "ENABLES" | "TRIGGERS" | "SUPPORTS" | "LINKED_TO";
export interface LifeGraphEdgePayload {
    id: string;
    fromType: GraphNodeType;
    fromId: string;
    toType: GraphNodeType;
    toId: string;
    relation: GraphRelation;
    label: string | null;
}
export interface LifeMomentPayload {
    id: string;
    title: string;
    description: string | null;
    category: string;
    domain: string | null;
    occurredAt: string;
    scoreDelta: number | null;
    permanent: boolean;
}
export interface LifeInsightPayload {
    id: string;
    insight: string;
    category: string;
    date: string;
}
export interface LifeGraphPayload {
    destination: {
        id: string;
        label: string;
    } | null;
    nodes: {
        type: GraphNodeType;
        id: string;
        label: string;
    }[];
    edges: LifeGraphEdgePayload[];
}
export interface LifeIntelligencePayload {
    tonightQuestion: string;
    insights: LifeInsightPayload[];
    learnedToday: string[];
}
/** Per-module open tracking for adaptive dashboard */
export interface ModuleUsageEntry {
    lastOpenedAt: string;
    openCount: number;
}
export type ModuleUsageMap = Partial<Record<string, ModuleUsageEntry>>;
/** Life Engine™ — one action from all life inputs */
export interface LifeEngineAction {
    title: string;
    reason: string;
    whyConnected: string;
    domain: string;
    domainSlug: "career" | "money" | "health" | "learning" | "relationships" | "memory" | null;
    actionLabel: string;
    actionHref: string;
    entityId?: string;
    scoreGain: number;
    sources: string[];
}
/** Life Engine™ daily streak (Duolingo-style retention) */
export interface LifeEngineStreakPayload {
    currentStreak: number;
    bestStreak: number;
    freezesRemaining: number;
    completedToday: boolean;
    atRisk: boolean;
    canUseFreeze: boolean;
}
export interface AccountabilityPartner {
    name: string;
    linkedUserId?: string;
}
export interface PartnerActivityPayload {
    name: string;
    currentStreak: number;
    bestStreak: number;
    completedToday: boolean;
    atRisk: boolean;
    mood?: string | null;
    statusLabel?: string;
}
export type LifeCircleRelationship = "FRIEND" | "FAMILY";
export declare const LIFE_CIRCLE_RELATIONSHIPS: LifeCircleRelationship[];
export declare const MAX_LIFE_CIRCLE_MEMBERS = 5;
export declare const REFERRAL_BONUS_VOICE_UNITS = 5;
export interface LifeCircleMemberPayload {
    id: string;
    displayName: string;
    relationship: LifeCircleRelationship;
    linkedUserId?: string | null;
    avatarUrl?: string | null;
    activity?: PartnerActivityPayload | null;
}
export interface LifeCircleSummary {
    members: LifeCircleMemberPayload[];
    referralCount: number;
    inviteCode: string;
}
/** Life Replay — annual recap */
export interface LifeReplayHighlight {
    id: string;
    title: string;
    occurredAt: string;
    emoji: string;
}
export interface LifeReplayPayload {
    year: number;
    headline: string;
    subheadline: string;
    isYearEnd: boolean;
    stats: {
        lifeMoments: number;
        goalsCompleted: number;
        tasksCompleted: number;
        scoreStart: number;
        scoreNow: number;
        scoreDelta: number;
        topDomain: string;
    };
    highlights: LifeReplayHighlight[];
    lessons: string[];
}

/** Life XP™ — capability growth across dimensions users care about (not a game score). */
export declare const LIFE_XP_DIMENSIONS: readonly [{
    readonly id: "career";
    readonly label: "Career";
    readonly color: "#7C3AED";
}, {
    readonly id: "health";
    readonly label: "Health";
    readonly color: "#EF4444";
}, {
    readonly id: "money";
    readonly label: "Money";
    readonly color: "#10B981";
}, {
    readonly id: "leadership";
    readonly label: "Leadership";
    readonly color: "#6366F1";
}, {
    readonly id: "communication";
    readonly label: "Communication";
    readonly color: "#0EA5E9";
}, {
    readonly id: "confidence";
    readonly label: "Confidence";
    readonly color: "#F59E0B";
}, {
    readonly id: "business";
    readonly label: "Business";
    readonly color: "#8B5CF6";
}, {
    readonly id: "learning";
    readonly label: "Learning";
    readonly color: "#3B82F6";
}];
export type LifeXpDimensionId = (typeof LIFE_XP_DIMENSIONS)[number]["id"];
export interface LifeXpGain {
    dimension: LifeXpDimensionId;
    amount: number;
    reason: string;
    createdAt: string;
}
export interface LifeXpDimensionState {
    id: LifeXpDimensionId;
    label: string;
    color: string;
    totalXp: number;
    /** Professional capability tier — not "Level 12" */
    capability: string;
    progressToNext: number;
    xpToNext: number;
    recentGain: number;
}
export interface LifeXpPayload {
    dimensions: LifeXpDimensionState[];
    recentGains: LifeXpGain[];
    headline: string;
    subheadline: string;
}
export interface LifeXpGrowthSnapshot {
    id: LifeXpDimensionId;
    label: string;
    color: string;
    yearXp: number;
    monthXp: number;
    capability: string;
    deltaMonth: number;
}
export interface LifeXpGrowthPayload {
    yearTotal: number;
    monthTotal: number;
    dimensions: LifeXpGrowthSnapshot[];
    recentMilestones: LifeXpGain[];
    headline: string;
}
export interface LifeXpAward {
    dimension: LifeXpDimensionId;
    amount: number;
    reason: string;
    sourceType?: string;
    sourceId?: string;
}

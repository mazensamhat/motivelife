/** Life XP™ — capability growth across dimensions users care about (not a game score). */

export const LIFE_XP_DIMENSIONS = [
  { id: "career", label: "Career", color: "#7C3AED" },
  { id: "health", label: "Health", color: "#EF4444" },
  { id: "money", label: "Money", color: "#10B981" },
  { id: "leadership", label: "Leadership", color: "#6366F1" },
  { id: "communication", label: "Communication", color: "#0EA5E9" },
  { id: "confidence", label: "Confidence", color: "#F59E0B" },
  { id: "business", label: "Business", color: "#8B5CF6" },
  { id: "learning", label: "Learning", color: "#3B82F6" },
] as const;

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

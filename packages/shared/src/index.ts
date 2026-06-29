export const LIFE_DOMAINS = [
  "CAREER",
  "MONEY",
  "HEALTH",
  "PROJECTS",
  "HABITS",
  "LEARNING",
  "RELATIONSHIPS",
  "TRAVEL",
  "BUSINESS",
  "DREAMS",
] as const;

export type LifeDomain = (typeof LIFE_DOMAINS)[number];

export const DOMAIN_LABELS: Record<LifeDomain, string> = {
  CAREER: "Career",
  MONEY: "Money",
  HEALTH: "Health",
  PROJECTS: "Projects",
  HABITS: "Habits",
  LEARNING: "Learning",
  RELATIONSHIPS: "Relationships",
  TRAVEL: "Travel",
  BUSINESS: "Business",
  DREAMS: "Dreams",
};

export const AGENT_TYPES = [
  "CAREER",
  "MONEY",
  "CALENDAR",
  "TASK",
  "HEALTH",
  "LEARNING",
  "TRAVEL",
  "GENERAL",
] as const;

export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_LABELS: Record<AgentType, string> = {
  CAREER: "Career Agent",
  MONEY: "Money Agent",
  CALENDAR: "Calendar Agent",
  TASK: "Task Agent",
  HEALTH: "Health Agent",
  LEARNING: "Learning Agent",
  TRAVEL: "Travel Agent",
  GENERAL: "motivelife.ai",
};

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
  topXpDimension: { id: string; label: string; amount: number } | null;
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

export const APPLICATION_STATUSES = [
  "SAVED",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export interface CreateApplicationInput {
  company: string;
  role: string;
  goalId?: string;
  status?: ApplicationStatus;
  url?: string;
  notes?: string;
  nextStep?: string;
}

export const MONEY_ITEM_TYPES = ["SAVINGS", "DEBT", "BILL"] as const;
export type MoneyItemType = (typeof MONEY_ITEM_TYPES)[number];

export const MONEY_TYPE_LABELS: Record<MoneyItemType, string> = {
  SAVINGS: "Savings goal",
  DEBT: "Debt payoff",
  BILL: "Bill / subscription",
};

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

export const HABIT_FREQUENCIES = ["DAILY", "WEEKLY"] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

export const HABIT_FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
};

export const HEALTH_ITEM_TYPES = ["SLEEP", "FITNESS", "NUTRITION", "WELLNESS"] as const;
export type HealthItemType = (typeof HEALTH_ITEM_TYPES)[number];

export const HEALTH_TYPE_LABELS: Record<HealthItemType, string> = {
  SLEEP: "Sleep",
  FITNESS: "Fitness",
  NUTRITION: "Nutrition",
  WELLNESS: "Wellness",
};

export const LEARNING_ITEM_TYPES = ["COURSE", "BOOK", "SKILL"] as const;
export type LearningItemType = (typeof LEARNING_ITEM_TYPES)[number];

export const LEARNING_TYPE_LABELS: Record<LearningItemType, string> = {
  COURSE: "Course",
  BOOK: "Book",
  SKILL: "Skill",
};

export const RELATIONSHIP_ITEM_TYPES = ["FAMILY", "FRIEND", "PARTNER", "COMMUNITY"] as const;
export type RelationshipItemType = (typeof RELATIONSHIP_ITEM_TYPES)[number];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipItemType, string> = {
  FAMILY: "Family",
  FRIEND: "Friends",
  PARTNER: "Partner",
  COMMUNITY: "Community",
};

export * from "./life-os";
export * from "./life-graph";
export * from "./life-xp";
export * from "./coaching-loop";
export * from "./voice-capture";
export * from "./voice-practice";
export * from "./voice-recap";
export * from "./ai-usage";

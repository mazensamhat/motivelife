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
];
export const DOMAIN_LABELS = {
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
];
export const AGENT_LABELS = {
    CAREER: "Career Agent",
    MONEY: "Money Agent",
    CALENDAR: "Calendar Agent",
    TASK: "Task Agent",
    HEALTH: "Health Agent",
    LEARNING: "Learning Agent",
    TRAVEL: "Travel Agent",
    GENERAL: "MotiveLife",
};
export const APPLICATION_STATUSES = [
    "SAVED",
    "APPLIED",
    "INTERVIEW",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
];
export const APPLICATION_STATUS_LABELS = {
    SAVED: "Saved",
    APPLIED: "Applied",
    INTERVIEW: "Interview",
    OFFER: "Offer",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
};
export { MONEY_ITEM_TYPES, MONEY_TYPE_LABELS, MONEY_TYPE_GROUPS, MONEY_GRAPH_CATEGORIES, COMMITMENT_MONEY_TYPES, ACCOUNT_MONEY_TYPES, isCommitmentType, monthlyFlowAmount, graphCategoryForType, } from "./money-categories";
export const HABIT_FREQUENCIES = ["DAILY", "WEEKLY"];
export const HABIT_FREQUENCY_LABELS = {
    DAILY: "Daily",
    WEEKLY: "Weekly",
};
export const HEALTH_ITEM_TYPES = ["SLEEP", "FITNESS", "NUTRITION", "WELLNESS"];
export const HEALTH_TYPE_LABELS = {
    SLEEP: "Sleep",
    FITNESS: "Fitness",
    NUTRITION: "Nutrition",
    WELLNESS: "Wellness",
};
export const LEARNING_ITEM_TYPES = ["COURSE", "BOOK", "SKILL"];
export const LEARNING_TYPE_LABELS = {
    COURSE: "Course",
    BOOK: "Book",
    SKILL: "Skill",
};
export const RELATIONSHIP_ITEM_TYPES = ["FAMILY", "FRIEND", "PARTNER", "COMMUNITY"];
export const RELATIONSHIP_TYPE_LABELS = {
    FAMILY: "Family",
    FRIEND: "Friends",
    PARTNER: "Partner",
    COMMUNITY: "Community",
};
export * from "./coach-setup";
export * from "./command-center";
export * from "./digital-twin";
export * from "./financial-profile";
export * from "./money-categories";
export * from "./what-if";
export * from "./product-feedback";
export * from "./life-os";
export * from "./life-graph";
export * from "./life-xp";
export * from "./coaching-loop";
export * from "./voice-capture";
export * from "./voice-practice";
export * from "./voice-recap";
export * from "./ai-usage";
export * from "./family-intelligence";
export * from "./location-circles";

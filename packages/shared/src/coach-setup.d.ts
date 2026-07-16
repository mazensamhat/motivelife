export declare const COACH_SETUP_REMINDER_IDS: readonly ["financial_profile", "money_commitments", "calendar", "beliefs", "goals", "birth_year", "coaching_preferences"];
export type CoachSetupReminderId = (typeof COACH_SETUP_REMINDER_IDS)[number];
export type CoachSetupImpact = "high" | "medium";
export interface CoachSetupReminder {
    id: CoachSetupReminderId;
    title: string;
    description: string;
    href: string;
    priority: number;
    coachImpact: CoachSetupImpact;
    /** Estimated minutes to complete */
    minutes?: number;
}

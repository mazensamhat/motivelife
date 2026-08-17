import type { CoachSetupReminder } from "@forward/shared";
import { isCommitmentType } from "@forward/shared";

export function buildCoachSetupReminders(input: {
  financialProfileComplete: boolean;
  moneyCommitmentCount: number;
  calendarConnected: boolean;
  beliefsCount: number;
  activeGoalsCount: number;
  birthYear: number | null | undefined;
  preferencesSaved: boolean;
}): CoachSetupReminder[] {
  const reminders: CoachSetupReminder[] = [];

  if (!input.financialProfileComplete) {
    reminders.push({
      id: "financial_profile",
      title: "Set up your Life Financial Profile",
      description:
        "Tell your coach your take-home pay and investing habits so it can guide money, career, and retirement — not track every coffee.",
      href: "/kashu",
      priority: 1,
      coachImpact: "high",
      minutes: 3,
    });
  } else if (input.moneyCommitmentCount < 2) {
    reminders.push({
      id: "money_commitments",
      title: "Add your monthly commitments",
      description:
        "Enter fixed costs once (mortgage, hydro, phone…). Your coach uses this baseline for cash-flow and “can I afford it?” coaching.",
      href: "/kashu#commitments",
      priority: 2,
      coachImpact: "high",
      minutes: 5,
    });
  }

  if (!input.calendarConnected) {
    reminders.push({
      id: "calendar",
      title: "Connect your calendar",
      description:
        "Google or Apple Calendar lets your chief of staff coach around your real schedule, prep for meetings, and suggest open slots.",
      href: "/integrations",
      priority: 3,
      coachImpact: "high",
      minutes: 2,
    });
  }

  if (input.beliefsCount === 0) {
    reminders.push({
      id: "beliefs",
      title: "Share what matters to you",
      description:
        "Beliefs like “family first” or “retire at 55” shape how your coach prioritizes trade-offs across career, money, and life.",
      href: "/settings",
      priority: 4,
      coachImpact: "high",
      minutes: 2,
    });
  }

  if (input.activeGoalsCount === 0) {
    reminders.push({
      id: "goals",
      title: "Set a north-star goal",
      description:
        "One active goal gives your coach direction for daily missions, Life Score, and Command Center focus.",
      href: "/goals",
      priority: 5,
      coachImpact: "medium",
      minutes: 3,
    });
  }

  if (!input.birthYear) {
    reminders.push({
      id: "birth_year",
      title: "Add your birth year",
      description:
        "Age-aware coaching for retirement timing, career stage, and generation-specific guidance on your dashboard.",
      href: "/settings",
      priority: 6,
      coachImpact: "medium",
      minutes: 1,
    });
  }

  if (!input.preferencesSaved) {
    reminders.push({
      id: "coaching_preferences",
      title: "Choose your coaching style",
      description:
        "Gentle vs direct reminders, task length, and peak hours — so your chief of staff matches how you actually work.",
      href: "/settings",
      priority: 7,
      coachImpact: "medium",
      minutes: 2,
    });
  }

  return reminders.sort((a, b) => a.priority - b.priority);
}

export function countMoneyCommitments(
  moneyItems: { type: string }[]
): number {
  return moneyItems.filter((m) => isCommitmentType(m.type)).length;
}

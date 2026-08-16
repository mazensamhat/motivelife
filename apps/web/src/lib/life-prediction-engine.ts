import type { LifePredictItem } from "@forward/shared";
import { monthlyFlowAmount } from "@forward/shared";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  isMission: boolean;
};

type MoneyRow = {
  id: string;
  type: string;
  title: string;
  targetAmount: number | null;
  currentAmount: number;
  dueDay: number | null;
  targetDate: Date | null;
};

type HabitRow = {
  title: string;
  streak: number;
  lastDoneAt: Date | null;
};

type HealthRow = {
  type: string;
  title: string;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
};

type CalendarEvent = {
  title: string;
  start: Date;
  hoursUntil: number;
};

type ApplicationRow = {
  company: string;
  role: string;
  status: string;
  updatedAt: Date;
};

export type LifePredictionContext = {
  tasks: TaskRow[];
  moneyItems: MoneyRow[];
  habits: HabitRow[];
  healthItems: HealthRow[];
  calendarEvents: CalendarEvent[];
  applications: ApplicationRow[];
  savingsProgress: number;
  savingsTarget: number | null;
  savingsCurrent: number;
  monthlyTakeHome: number;
  availableMonthly: number;
  monthlySurvivalNumber: number;
  safeToSpend: number;
  upcomingBills: { title: string; amount: number; daysUntil: number }[];
  workoutStreak: number;
  sleepHoursRecent: number | null;
  healthScoreDelta: number;
  careerScoreDelta: number;
  domainScores: { health: number; career: number; money: number };
  relationshipDaysSinceTouch: number | null;
  interviewWithinDays: number | null;
  voicePracticeRecent: boolean;
  month: number;
  dayOfMonth: number;
};

function daysUntilDue(dueDay: number) {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (due < now) due.setMonth(due.getMonth() + 1);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function push(
  items: LifePredictItem[],
  item: Omit<LifePredictItem, "id"> & { id?: string }
) {
  if (items.length >= 10) return;
  items.push({ ...item, id: item.id ?? `pred-${items.length}` });
}

export function generateLifePredictions(ctx: LifePredictionContext): LifePredictItem[] {
  const items: LifePredictItem[] = [];

  const overdue = ctx.tasks.filter(
    (t) => t.dueDate && t.dueDate < new Date() && t.status !== "DONE"
  );
  const dueSoon = ctx.tasks.filter((t) => {
    if (!t.dueDate || t.status === "DONE") return false;
    const days = (t.dueDate.getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 3;
  });

  if (overdue.length > 0) {
    push(items, {
      id: "deadline-overdue",
      text: `You're likely to miss "${overdue[0].title}" — it was due already.`,
      tone: "urgent",
      category: "deadline",
      confidence: 92,
      href: "/tasks",
      subtitle: "Deadline risk",
    });
  } else if (dueSoon.length > 0) {
    const t = dueSoon[0];
    const days = Math.ceil((t.dueDate!.getTime() - Date.now()) / 86400000);
    push(items, {
      id: "deadline-soon",
      text: `You're likely to miss "${t.title}" unless you act in the next ${days} day${days === 1 ? "" : "s"}.`,
      tone: "warning",
      category: "deadline",
      confidence: 78,
      href: "/tasks",
      subtitle: "Deadline risk",
    });
  }

  if (ctx.savingsTarget && ctx.savingsTarget > 0 && ctx.monthlyTakeHome > 0) {
    const remaining = Math.max(0, ctx.savingsTarget - ctx.savingsCurrent);
    const monthlyPace = ctx.availableMonthly * 0.15;
    if (monthlyPace > 0 && remaining > 0) {
      const monthsLeft = remaining / monthlyPace;
      const slipDays = Math.round(Math.max(0, monthsLeft - 12) * 30);
      if (slipDays > 7 && ctx.savingsProgress < 70) {
        push(items, {
          id: "savings-slip",
          text: `Your savings goal will slip by about ${slipDays} days if spending continues at this pace.`,
          tone: "warning",
          category: "money",
          confidence: 74,
          href: "/kashu",
          subtitle: "Money forecast",
        });
      } else if (ctx.savingsProgress >= 55) {
        const aheadDays = Math.round(Math.min(45, (ctx.savingsProgress - 50) * 1.2));
        push(items, {
          id: "savings-ahead",
          text: `You're on pace to hit your savings goal about ${aheadDays} days early.`,
          tone: "positive",
          category: "money",
          confidence: 68,
          href: "/kashu",
          subtitle: "Money forecast",
        });
      }
    }
  }

  for (const bill of ctx.upcomingBills) {
    if (bill.daysUntil <= 3 && bill.daysUntil >= 0 && ctx.safeToSpend < bill.amount) {
      const shortfall = Math.round(bill.amount - ctx.safeToSpend);
      push(items, {
        id: `bill-${bill.title}`,
        text: `Your ${bill.title} comes out in ${bill.daysUntil} day${bill.daysUntil === 1 ? "" : "s"}. Waiting may leave you short by about $${shortfall}.`,
        tone: bill.daysUntil <= 1 ? "urgent" : "warning",
        category: "money",
        confidence: 85,
        href: "/kashu",
        subtitle: "Cashflow warning",
      });
      break;
    }
  }

  const weightGoal = ctx.healthItems.find(
    (h) => /weight|pounds|kg|lose/i.test(h.title) && h.targetValue
  );
  if (weightGoal?.targetValue && weightGoal.currentValue > weightGoal.targetValue) {
    const toLose = weightGoal.currentValue - weightGoal.targetValue;
    const weeklyRate = 0.5;
    const weeks = Math.ceil(toLose / weeklyRate);
    const target = new Date();
    target.setDate(target.getDate() + weeks * 7);
    const month = target.toLocaleString("en-US", { month: "long" });
    push(items, {
      id: "weight-pace",
      text: `You're on pace to lose about ${Math.round(toLose)} ${weightGoal.unit ?? "lb"} by ${month} at your current trend.`,
      tone: "positive",
      category: "health",
      confidence: 62,
      href: "/health",
      subtitle: "Health forecast",
    });
  }

  const lowSleep = ctx.sleepHoursRecent != null && ctx.sleepHoursRecent < 6;
  const burnoutSignals =
    (lowSleep ? 1 : 0) +
    (ctx.workoutStreak === 0 ? 1 : 0) +
    (ctx.healthScoreDelta < -3 ? 1 : 0) +
    (ctx.calendarEvents.length >= 4 ? 1 : 0);
  if (burnoutSignals >= 3) {
    const pct = Math.min(40, 15 + burnoutSignals * 8);
    push(items, {
      id: "burnout-risk",
      text: `Burnout risk has increased about ${pct}% this week — protect sleep and one recovery block.`,
      tone: "warning",
      category: "health",
      confidence: 71,
      href: "/health",
      subtitle: "Energy forecast",
    });
  }

  if (ctx.interviewWithinDays != null && ctx.interviewWithinDays <= 2 && lowSleep) {
    push(items, {
      id: "sleep-interview",
      text: `You've slept under 6 hours recently and your interview is in ${ctx.interviewWithinDays} day${ctx.interviewWithinDays === 1 ? "" : "s"}. Go to bed before 10:30 PM.`,
      tone: "urgent",
      category: "career",
      confidence: 88,
      href: "/career",
      subtitle: "Interview prep",
    });
  }

  if (ctx.voicePracticeRecent && ctx.applications.length > 0) {
    push(items, {
      id: "interview-momentum",
      text: "Your interview success probability increased after yesterday's practice — keep the streak going.",
      tone: "positive",
      category: "career",
      confidence: 65,
      href: "/career",
      subtitle: "Career forecast",
    });
  }

  const nextEvent = ctx.calendarEvents.find((e) => e.hoursUntil > 0 && e.hoursUntil < 4);
  if (nextEvent) {
    const leaveHour = new Date(nextEvent.start.getTime() - 25 * 60000);
    const leaveLabel = leaveHour.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    push(items, {
      id: "calendar-leave",
      text: `If you leave around ${leaveLabel} for "${nextEvent.title}", you'll likely arrive with time to spare.`,
      tone: "info",
      category: "calendar",
      confidence: 70,
      href: "/dashboard#command-center",
      subtitle: "Calendar forecast",
    });
  }

  if (
    ctx.careerScoreDelta > 4 &&
    ctx.domainScores.career >= 70 &&
    [1, 4, 10].includes(ctx.month)
  ) {
    push(items, {
      id: "salary-window",
      text: "This looks like a strong week to negotiate your salary — career momentum is up.",
      tone: "positive",
      category: "career",
      confidence: 58,
      href: "/career",
      subtitle: "Career timing",
    });
  }

  if (ctx.relationshipDaysSinceTouch != null && ctx.relationshipDaysSinceTouch >= 14) {
    push(items, {
      id: "relationship-drift",
      text: `You haven't logged time with someone important in ${ctx.relationshipDaysSinceTouch} days. Plan something this weekend.`,
      tone: "warning",
      category: "relationship",
      confidence: 76,
      href: "/relationships",
      subtitle: "Relationship forecast",
    });
  }

  if (ctx.workoutStreak >= 5) {
    push(items, {
      id: "fitness-momentum",
      text: "Your exercise consistency is improving — keep this streak to raise your health score.",
      tone: "positive",
      category: "health",
      confidence: 80,
      href: "/health",
      subtitle: "Health momentum",
    });
  }

  if (items.length === 0) {
    push(items, {
      id: "default-momentum",
      text: "Complete today's mission to keep your Life Score trending up this week.",
      tone: "info",
      category: "general",
      confidence: 55,
      href: "/dashboard#mission",
      subtitle: "Daily forecast",
    });
  }

  return items.slice(0, 8);
}

export function buildUpcomingBillsFromMoneyItems(moneyItems: MoneyRow[]) {
  return moneyItems
    .filter((m) => m.dueDay != null && ["BILL", "HOUSING", "SUBSCRIPTION", "COMMITMENT"].includes(m.type))
    .map((m) => ({
      title: m.title,
      amount: monthlyFlowAmount(m),
      daysUntil: daysUntilDue(m.dueDay!),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

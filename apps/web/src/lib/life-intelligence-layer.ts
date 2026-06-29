import { prisma } from "@forward/database";
import type { LifeContextId, LifeContextState, LifeIntelligencePayload } from "@forward/shared";
import { startOfDay } from "./api";
import { buildSuggestionContext } from "./forward";

type CalendarBrief = { title: string; hoursUntil: number; start?: Date };

function contextFromCalendar(events: CalendarBrief[]): LifeContextState | null {
  const now = Date.now();

  const makeCtx = (id: LifeContextId, label: string, expiresAt: Date): LifeContextState => ({
    id,
    label,
    activeSince: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    autoDetected: true,
  });

  for (const e of events) {
    if (e.hoursUntil < 0 || e.hoursUntil > 36) continue;
    const t = e.title.toLowerCase();
    if (/interview|screening|recruiter call|hiring/i.test(t)) {
      const end = new Date(now + e.hoursUntil * 3600000 + 86400000);
      return makeCtx("interview", "Interview Soon", end);
    }
  }

  for (const e of events) {
    if (e.hoursUntil < 0 || e.hoursUntil > 14 * 24) continue;
    const t = e.title.toLowerCase();
    if (/vacation|holiday|trip|flight|pto|travel|away|airport|cruise/i.test(t)) {
      const end = new Date(now + e.hoursUntil * 3600000 + 7 * 86400000);
      return makeCtx("vacation", "Vacation", end);
    }
  }

  for (const e of events) {
    if (e.hoursUntil < 0 || e.hoursUntil > 60 * 24) continue;
    const t = e.title.toLowerCase();
    if (/wedding|rehearsal|bridal|engagement party/i.test(t)) {
      const end = new Date(now + e.hoursUntil * 3600000 + 3 * 86400000);
      return makeCtx("wedding", "Wedding", end);
    }
  }

  for (const e of events) {
    if (e.hoursUntil < 0 || e.hoursUntil > 30 * 24) continue;
    const t = e.title.toLowerCase();
    if (/moving|move-in|move out|lease signing|new apartment|new home/i.test(t)) {
      const end = new Date(now + e.hoursUntil * 3600000 + 14 * 86400000);
      return makeCtx("moving", "Moving", end);
    }
  }

  for (const e of events) {
    if (e.hoursUntil < 0 || e.hoursUntil > 7 * 24) continue;
    const t = e.title.toLowerCase();
    if (/performance review|promotion|annual review|comp review|1:1 with/i.test(t)) {
      const end = new Date(now + e.hoursUntil * 3600000 + 86400000);
      return makeCtx("promotion", "Promotion", end);
    }
  }

  return null;
}

function contextFromMoney(
  moneyItems: { title: string; type: string; daysUntilDue: number | null }[]
): LifeContextState | null {
  const urgentBill = moneyItems.find(
    (m) =>
      m.type === "BILL" &&
      m.daysUntilDue != null &&
      m.daysUntilDue >= 0 &&
      m.daysUntilDue <= 3
  );
  if (!urgentBill) return null;

  if (/mortgage|rent|house|home|hoa|property/i.test(urgentBill.title)) {
    return {
      id: "buying_house",
      label: "Buying a House",
      activeSince: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      autoDetected: true,
    };
  }

  return null;
}

export async function detectLifeContext(userId: string): Promise<LifeContextState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeContext: true, lifeFocuses: true, lifeDestination: true, birthYear: true },
  });

  if (user?.activeContext) {
    try {
      const ctx = JSON.parse(user.activeContext) as LifeContextState;
      if (!ctx.expiresAt || new Date(ctx.expiresAt) > new Date()) return ctx;
    } catch {
      /* fall through to auto-detect */
    }
  }

  const context = await buildSuggestionContext(userId);
  const focuses = user?.lifeFocuses ? (JSON.parse(user.lifeFocuses) as string[]) : [];
  let detected: LifeContextState | null = null;

  for (const app of context.applications ?? []) {
    if (app.status === "INTERVIEW" && app.interviewAt) {
      const hours = (app.interviewAt.getTime() - Date.now()) / 3600000;
      if (hours > 0 && hours <= 36) {
        detected = {
          id: "interview",
          label: "Interview Tomorrow",
          activeSince: new Date().toISOString(),
          expiresAt: new Date(app.interviewAt.getTime() + 86400000).toISOString(),
          autoDetected: true,
        };
        break;
      }
    }
  }

  if (!detected && context.calendarEvents?.length) {
    detected = contextFromCalendar(context.calendarEvents);
  }

  if (!detected && context.moneyItems?.length) {
    detected = contextFromMoney(context.moneyItems);
  }

  if (!detected && user?.birthYear) {
    const age = new Date().getFullYear() - user.birthYear;
    if (
      age >= 59 &&
      (focuses.includes("plan_retirement") || /retire|retirement/i.test(user.lifeDestination ?? ""))
    ) {
      detected = {
        id: "retirement",
        label: "Retirement",
        activeSince: new Date().toISOString(),
        autoDetected: true,
      };
    }
  }

  if (!detected && focuses.includes("start_business")) {
    detected = {
      id: "starting_business",
      label: "Starting Business",
      activeSince: new Date().toISOString(),
      autoDetected: true,
    };
  }

  if (!detected && focuses.includes("finish_school")) {
    detected = {
      id: "student",
      label: "Student",
      activeSince: new Date().toISOString(),
      autoDetected: true,
    };
  }

  if (!detected) {
    if (focuses.includes("save_house") || /house|home|mortgage/i.test(user?.lifeDestination ?? "")) {
      detected = {
        id: "buying_house",
        label: "Buying a House",
        activeSince: new Date().toISOString(),
        autoDetected: true,
      };
    } else if (focuses.includes("find_job")) {
      detected = {
        id: "unemployed",
        label: "Job Search",
        activeSince: new Date().toISOString(),
        autoDetected: true,
      };
    } else if (focuses.includes("get_promoted")) {
      detected = {
        id: "promotion",
        label: "Promotion",
        activeSince: new Date().toISOString(),
        autoDetected: true,
      };
    } else if (focuses.includes("travel_more")) {
      detected = {
        id: "vacation",
        label: "Vacation",
        activeSince: new Date().toISOString(),
        autoDetected: true,
      };
    }
  }

  if (detected?.autoDetected) {
    await prisma.user
      .update({
        where: { id: userId },
        data: { activeContext: JSON.stringify(detected) },
      })
      .catch(() => undefined);
  }

  return detected;
}

export async function setLifeContext(userId: string, contextId: LifeContextId | null) {
  if (!contextId) {
    await prisma.user.update({ where: { id: userId }, data: { activeContext: null } });
    return null;
  }

  const labels: Record<string, string> = {
    student: "Student",
    vacation: "Vacation",
    new_parent: "New Parent",
    buying_house: "Buying a House",
    wedding: "Wedding",
    unemployed: "Job Search",
    promotion: "Promotion",
    retirement: "Retirement",
    starting_business: "Starting Business",
    moving: "Moving",
    interview: "Interview Tomorrow",
  };

  const state: LifeContextState = {
    id: contextId,
    label: labels[contextId] ?? contextId,
    activeSince: new Date().toISOString(),
  };

  await prisma.user.update({
    where: { id: userId },
    data: { activeContext: JSON.stringify(state) },
  });

  return state;
}

export async function generateDailyLifeInsights(userId: string): Promise<LifeIntelligencePayload> {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await prisma.lifeInsight.findMany({
    where: { userId, date: { gte: today, lt: tomorrow } },
    orderBy: { createdAt: "desc" },
  });

  if (existing.length > 0) {
    return {
      tonightQuestion: "What did I learn about you today?",
      insights: existing.map((i) => ({
        id: i.id,
        insight: i.insight,
        category: i.category,
        date: i.date.toISOString(),
      })),
      learnedToday: existing.map((i) => i.insight),
    };
  }

  const [tasks, habits, moneyItems, completions] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { in: ["TODO", "IN_PROGRESS", "DONE"] } },
      take: 30,
    }),
    prisma.habit.findMany({ where: { userId, active: true } }),
    prisma.moneyItem.findMany({ where: { userId } }),
    prisma.task.findMany({
      where: { userId, status: "DONE", completedAt: { gte: today, lt: tomorrow } },
    }),
  ]);

  const insights: { insight: string; category: string }[] = [];

  const morningDone = completions.filter((t) => t.completedAt && t.completedAt.getHours() < 12);
  if (morningDone.length >= 2) {
    insights.push({
      category: "PATTERN",
      insight: "You finish difficult work best between 8–10 AM.",
    });
  }

  const friday = new Date().getDay() === 5;
  if (friday && moneyItems.some((m) => /food|restaurant|uber|dining/i.test(m.title))) {
    insights.push({
      category: "PATTERN",
      insight: "You tend to overspend on Fridays.",
    });
  }

  const fitness = habits.filter((h) => /workout|walk|gym|run/i.test(h.title));
  const missedFitness = fitness.filter((h) => !h.lastDoneAt || h.lastDoneAt < today);
  if (missedFitness.length > 0 && completions.length === 0) {
    insights.push({
      category: "PATTERN",
      insight: "You skip workouts after quiet days — a short walk breaks the pattern.",
    });
  }

  const longTasks = tasks.filter((t) => t.status !== "DONE" && (t.title.length > 40 || t.priority === "LOW"));
  if (longTasks.length >= 2) {
    insights.push({
      category: "PATTERN",
      insight: "You procrastinate when tasks feel longer than 45 minutes — break them smaller.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      category: "STRENGTH",
      insight: "You show up consistently — small daily wins are your superpower.",
    });
  }

  const created = await Promise.all(
    insights.slice(0, 4).map((ins) =>
      prisma.lifeInsight.create({
        data: {
          userId,
          date: today,
          insight: ins.insight,
          category: ins.category,
        },
      })
    )
  );

  return {
    tonightQuestion: "What did I learn about you today?",
    insights: created.map((i) => ({
      id: i.id,
      insight: i.insight,
      category: i.category,
      date: i.date.toISOString(),
    })),
    learnedToday: created.map((i) => i.insight),
  };
}

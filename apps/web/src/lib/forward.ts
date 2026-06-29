import {
  generateBriefing,
  generateBriefingWithAI,
  generateEveningReviewWithAI,
  generateWeeklyReviewWithAI,
  generateEveningReview,
  generateWeeklyReview,
  generateMonthlyReview,
  generateQuarterlyReview,
  generateSuggestions,
  buildMoneyItemContext,
  buildHealthItemContext,
  buildLearningItemContext,
  habitDoneToday,
  habitDaysSinceLastDone,
  type BriefingContext,
  type PersonaLayers,
  type EveningReviewContext,
  type WeeklyReviewContext,
  type MonthlyReviewContext,
  type QuarterlyReviewContext,
  type SuggestionContext,
} from "@forward/ai";
import { prisma, type LifeDomain, type ProgressType } from "@forward/database";
import type { BriefingHeroLines, LifeGraphPayload, WeekProgressStats } from "@forward/shared";
import { LIFE_XP_DIMENSIONS } from "@forward/shared";
import { getOpenAiApiKey } from "./openai-config";
import { parseUserPersona } from "./user-persona";
import { buildVoiceWeeklyRecap, voiceRecapForWeeklyReview } from "./voice-weekly-recap";
import {
  hasNightReflectionToday,
  recordAiUsage,
} from "./ai-usage";
import { isPremiumUser } from "./subscription";
import {
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
} from "./api";
import { getGoogleCalendarEvents } from "./google-calendar";

function toCalendarBrief(events: { title: string; start: Date }[]) {
  const now = Date.now();
  return events.map((e) => ({
    title: e.title,
    start: e.start,
    hoursUntil: (e.start.getTime() - now) / (1000 * 60 * 60),
  }));
}

export async function recordProgressMoment(
  userId: string,
  title: string,
  type: ProgressType,
  domain?: LifeDomain | null
) {
  await prisma.progressMoment.create({
    data: { userId, title, type, domain: domain ?? undefined },
  });
}

export async function buildBriefingContext(
  userId: string,
  userName: string | null,
  personaExtras?: {
    graph?: LifeGraphPayload | null;
    learnedToday?: string[];
    lifeEngineStreak?: number;
    completedToday?: number;
    activeContext?: PersonaLayers["activeContext"];
  }
): Promise<BriefingContext> {
  const [goals, tasks, user] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["TODO", "IN_PROGRESS"] } },
      include: { goal: { select: { title: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        birthYear: true,
        beliefs: true,
        preferences: true,
        activeContext: true,
        lifeDestination: true,
      },
    }),
  ]);

  const today = startOfDay();
  const taskContexts = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    isMission: t.isMission,
    goalTitle: t.goal?.title,
  }));

  const overdueTasks = taskContexts.filter((t) => t.dueDate && t.dueDate < today);
  const missionTask = taskContexts.find((t) => t.isMission) ?? null;

  const calendarRaw = await getGoogleCalendarEvents(userId, 1).catch(() => []);
  const calendarEvents = toCalendarBrief(calendarRaw);

  const persona = parseUserPersona(user ?? {});
  let activeContext = personaExtras?.activeContext ?? null;
  if (!activeContext && user?.activeContext) {
    try {
      activeContext = JSON.parse(user.activeContext);
    } catch {
      /* ignore */
    }
  }

  const personaLayers: PersonaLayers = {
    userName,
    birthYear: user?.birthYear ?? null,
    beliefs: persona.beliefs,
    preferences: persona.preferences,
    activeContext,
    lifeDestination: user?.lifeDestination ?? null,
    graph: personaExtras?.graph ?? null,
    learnedToday: personaExtras?.learnedToday ?? [],
    lifeEngineStreak: personaExtras?.lifeEngineStreak,
    completedToday: personaExtras?.completedToday,
  };

  return {
    userName,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      progress: g.progress,
      status: g.status,
    })),
    tasks: taskContexts,
    overdueTasks,
    missionTask,
    calendarEvents,
    persona: personaLayers,
  };
}

export type BriefingAiExtras = {
  hero?: BriefingHeroLines;
  coach?: { prompt: string; suggestion: string };
};

export async function getOrCreateDailyBriefing(
  userId: string,
  userName: string | null,
  personaExtras?: Parameters<typeof buildBriefingContext>[2]
) {
  const today = startOfDay();

  const existing = await prisma.dailyBriefing.findFirst({
    where: {
      userId,
      date: { gte: today },
    },
  });

  if (existing) {
    let aiExtras: BriefingAiExtras | undefined;
    try {
      if (existing.aiExtras) aiExtras = JSON.parse(existing.aiExtras);
    } catch {
      /* ignore */
    }
    return {
      id: existing.id,
      priorities: JSON.parse(existing.priorities) as string[],
      mission: existing.mission,
      suggestedAction: existing.suggestedAction,
      summary: existing.summary,
      hero: aiExtras?.hero,
      coach: aiExtras?.coach,
      cached: true,
    };
  }

  const context = await buildBriefingContext(userId, userName, personaExtras);
  const premium = await isPremiumUser(userId);
  const apiKey = premium ? getOpenAiApiKey() : null;
  let briefing = generateBriefing(context);
  if (apiKey) {
    const { briefing: aiBriefing, usage } = await generateBriefingWithAI(context, apiKey);
    briefing = aiBriefing;
    await recordAiUsage(userId, "daily_briefing", usage);
  }

  const aiExtras: BriefingAiExtras | undefined =
    briefing.hero || briefing.coach
      ? { hero: briefing.hero, coach: briefing.coach }
      : undefined;

  const created = await prisma.dailyBriefing.create({
    data: {
      userId,
      date: today,
      priorities: JSON.stringify(briefing.priorities),
      mission: briefing.mission,
      suggestedAction: briefing.suggestedAction,
      summary: briefing.summary,
      aiExtras: aiExtras ? JSON.stringify(aiExtras) : undefined,
    },
  });

  return {
    id: created.id,
    priorities: briefing.priorities,
    mission: briefing.mission,
    suggestedAction: briefing.suggestedAction,
    summary: briefing.summary,
    hero: briefing.hero,
    coach: briefing.coach,
    cached: false,
  };
}

export async function buildSuggestionContext(userId: string): Promise<SuggestionContext> {
  const goals = await prisma.goal.findMany({
    where: { userId, status: "ACTIVE" },
    include: { tasks: { where: { status: { in: ["TODO", "IN_PROGRESS", "DONE"] } } } },
  });

  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ["TODO", "IN_PROGRESS"] } },
    include: { goal: { select: { title: true } } },
  });

  const [applications, moneyItems, habits, healthItems, learningItems, memories] = await Promise.all([
    prisma.jobApplication
      .findMany({
        where: { userId, status: { notIn: ["REJECTED", "WITHDRAWN"] } },
        orderBy: { updatedAt: "desc" },
      })
      .catch(() => [] as Awaited<ReturnType<typeof prisma.jobApplication.findMany>>),
    prisma.moneyItem.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }).catch(() => []),
    prisma.habit.findMany({ where: { userId, active: true }, orderBy: { updatedAt: "desc" } }).catch(() => []),
    prisma.healthItem.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }).catch(() => []),
    prisma.learningItem.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }).catch(() => []),
    prisma.memory.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 10 }).catch(() => []),
  ]);

  const staleGoals = goals.filter((g) => {
    const lastActivity = g.tasks.length
      ? Math.max(...g.tasks.map((t) => t.updatedAt.getTime()))
      : g.updatedAt.getTime();
    const days = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));
    return days >= 14;
  });

  return {
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      progress: g.progress,
      status: g.status,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      isMission: t.isMission,
      goalTitle: t.goal?.title,
    })),
    staleGoals: staleGoals.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      progress: g.progress,
      status: g.status,
    })),
    applications: applications.map((a) => ({
      id: a.id,
      company: a.company,
      role: a.role,
      status: a.status,
      appliedAt: a.appliedAt,
      interviewAt: a.interviewAt,
      daysSinceUpdate: Math.floor((Date.now() - a.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
      nextStep: a.nextStep,
    })),
    moneyItems: moneyItems.map((m) =>
      buildMoneyItemContext({
        id: m.id,
        type: m.type,
        title: m.title,
        targetAmount: m.targetAmount,
        currentAmount: m.currentAmount,
        dueDay: m.dueDay,
        targetDate: m.targetDate,
      })
    ),
    calendarEvents: toCalendarBrief(await getGoogleCalendarEvents(userId, 1).catch(() => [])),
    habits: habits.map((h) => ({
      id: h.id,
      title: h.title,
      frequency: h.frequency,
      streak: h.streak,
      doneToday: habitDoneToday(h.lastDoneAt),
      daysSinceLastDone: habitDaysSinceLastDone(h.lastDoneAt),
    })),
    healthItems: healthItems.map((h) =>
      buildHealthItemContext({
        id: h.id,
        type: h.type,
        title: h.title,
        targetValue: h.targetValue,
        currentValue: h.currentValue,
        unit: h.unit,
      })
    ),
    learningItems: learningItems.map((l) =>
      buildLearningItemContext({
        id: l.id,
        type: l.type,
        title: l.title,
        progress: l.progress,
        targetDate: l.targetDate,
        updatedAt: l.updatedAt,
      })
    ),
    emails: [],
    memories: memories.map((m) => ({
      id: m.id,
      title: m.content.slice(0, 80),
      content: m.content,
    })),
  };
}

export async function refreshSuggestions(userId: string) {
  const context = await buildSuggestionContext(userId);
  const suggestions = generateSuggestions(context);

  await prisma.suggestedAction.updateMany({
    where: { userId, status: "PENDING" },
    data: { status: "DISMISSED" },
  });

  if (suggestions.length > 0) {
    await prisma.suggestedAction.createMany({
      data: suggestions.map((s) => ({
        userId,
        agent: s.agent,
        title: s.title,
        reason: s.reason,
      })),
    });
  }

  return prisma.suggestedAction.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
}

function endOfDay(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

export async function buildEveningReviewContext(userId: string, userName: string | null): Promise<EveningReviewContext> {
  const today = startOfDay();
  const tomorrow = endOfDay();

  const [goals, completedToday, pendingTasks, userRow, xpToday] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: today, lt: tomorrow },
      },
      include: { goal: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["TODO", "IN_PROGRESS"] } },
      include: { goal: { select: { title: true } } },
      orderBy: [{ isMission: "desc" }, { priority: "desc" }],
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        beliefs: true,
        preferences: true,
        birthYear: true,
        lifeDestination: true,
        lifeEngineStreak: true,
        activeContext: true,
      },
    }),
    prisma.lifeXpEntry.aggregate({
      where: { userId, createdAt: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
    }),
  ]);

  const mapTask = (t: (typeof completedToday)[0]) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    isMission: t.isMission,
    goalTitle: t.goal?.title,
  });

  const missionCompleted = completedToday.some((t) => t.isMission);
  const persona = parseUserPersona(userRow ?? {});

  let activeContext: PersonaLayers["activeContext"] = null;
  if (userRow?.activeContext) {
    try {
      activeContext = JSON.parse(userRow.activeContext);
    } catch {
      /* ignore */
    }
  }

  const personaLayers: PersonaLayers = {
    userName,
    birthYear: userRow?.birthYear ?? null,
    beliefs: persona.beliefs,
    preferences: persona.preferences,
    activeContext,
    lifeDestination: userRow?.lifeDestination ?? null,
    graph: null,
    learnedToday: [],
    lifeEngineStreak: userRow?.lifeEngineStreak ?? 0,
    completedToday: completedToday.length,
  };

  return {
    userName,
    completedToday: completedToday.map(mapTask),
    pendingTasks: pendingTasks.map(mapTask),
    missionCompleted,
    activeGoals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      progress: g.progress,
      status: g.status,
    })),
    lifeEngineStreak: userRow?.lifeEngineStreak ?? 0,
    lifeXpToday: xpToday._sum.amount ?? 0,
    persona: personaLayers,
  };
}

export async function getOrCreateEveningReview(userId: string, userName: string | null) {
  const today = startOfDay();
  const tomorrow = endOfDay();

  const existing = await prisma.eveningReview.findFirst({
    where: {
      userId,
      date: { gte: today, lt: tomorrow },
    },
  });

  if (existing) {
    return {
      id: existing.id,
      completedCount: existing.completedCount,
      completedTasks: JSON.parse(existing.completedTasks) as string[],
      highlight: existing.highlight,
      carryForward: existing.carryForward,
      summary: existing.summary,
      cached: true,
    };
  }

  const context = await buildEveningReviewContext(userId, userName);
  const skipAi = await hasNightReflectionToday(userId);
  const premium = await isPremiumUser(userId);
  const apiKey = premium && !skipAi ? getOpenAiApiKey() : null;
  let review = generateEveningReview(context);
  if (apiKey) {
    const { review: aiReview, usage } = await generateEveningReviewWithAI(context, apiKey);
    review = aiReview;
    await recordAiUsage(userId, "evening_review", usage);
  }

  const created = await prisma.eveningReview.create({
    data: {
      userId,
      date: today,
      completedCount: review.completedCount,
      completedTasks: JSON.stringify(review.completedTasks),
      highlight: review.highlight,
      carryForward: review.carryForward,
      summary: review.summary,
    },
  });

  return {
    id: created.id,
    ...review,
    aiGenerated: Boolean(apiKey),
    cached: false,
  };
}

export async function getProgressStats(userId: string) {
  const today = startOfDay();
  const tomorrow = endOfDay();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [completedToday, completedWeek, activeGoals, totalMoments, recentMoments] = await Promise.all([
    prisma.task.count({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: weekAgo },
      },
    }),
    prisma.goal.count({ where: { userId, status: "ACTIVE" } }),
    prisma.progressMoment.count({ where: { userId } }),
    prisma.progressMoment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    completedToday,
    completedWeek,
    activeGoals,
    livesMovedForward: totalMoments,
    recentMoments,
  };
}

export async function getWeekProgressStats(userId: string): Promise<WeekProgressStats> {
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();

  const [tasksCompleted, xpEntries, coachingDaysCompleted, streakRow] = await Promise.all([
    prisma.task.count({
      where: { userId, status: "DONE", completedAt: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.lifeXpEntry.findMany({
      where: { userId, createdAt: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.lifeXpEntry.count({
      where: { userId, sourceType: "CHALLENGE", createdAt: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { lifeEngineStreak: true },
    }),
  ]);

  const dimMap = new Map<string, number>();
  let lifeXpGained = 0;
  for (const e of xpEntries) {
    lifeXpGained += e.amount;
    dimMap.set(e.dimension, (dimMap.get(e.dimension) ?? 0) + e.amount);
  }

  const topEntry = [...dimMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const topMeta = topEntry
    ? LIFE_XP_DIMENSIONS.find((d) => d.id === topEntry[0])
    : undefined;

  return {
    tasksCompleted,
    lifeXpGained,
    coachingDaysCompleted,
    lifeEngineStreak: streakRow?.lifeEngineStreak ?? 0,
    topXpDimension: topEntry && topMeta
      ? { id: topEntry[0], label: topMeta.label, amount: topEntry[1] }
      : null,
  };
}

export async function getOrCreateWeeklyReview(userId: string, userName: string | null) {
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();

  const existing = await prisma.weeklyReview.findFirst({
    where: { userId, weekStart: { gte: weekStart, lt: weekEnd } },
  });

  if (existing) {
    const letterBody = existing.letterBody
      ? (JSON.parse(existing.letterBody) as string[])
      : existing.summary
        ? existing.summary.split("\n\n").filter(Boolean)
        : [];
    const [weekStats, voiceRecap] = await Promise.all([
      getWeekProgressStats(userId),
      buildVoiceWeeklyRecap(userId, weekStart, weekEnd),
    ]);
    return {
      id: existing.id,
      tasksCompleted: existing.tasksCompleted,
      wins: JSON.parse(existing.wins) as string[],
      focusAreas: JSON.parse(existing.focusAreas) as string[],
      goalsSummary: existing.goalsSummary,
      summary: existing.summary,
      letterParagraphs: letterBody,
      weekStats,
      voiceRecap,
      cached: true,
    };
  }

  const [tasksCompleted, activeGoals, goalsCompletedThisWeek, lifeMomentsThisWeek, progressMomentsThisWeek, pendingTasks, userRow, streakRow, weekStats] =
    await Promise.all([
    prisma.task.count({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: weekStart, lt: weekEnd },
      },
    }),
    prisma.goal.findMany({ where: { userId, status: "ACTIVE" } }),
    prisma.goal.count({
      where: {
        userId,
        status: "COMPLETED",
        updatedAt: { gte: weekStart, lt: weekEnd },
      },
    }),
    prisma.lifeMoment.findMany({
      where: { userId, occurredAt: { gte: weekStart, lt: weekEnd } },
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
    prisma.progressMoment.findMany({
      where: { userId, createdAt: { gte: weekStart, lt: weekEnd } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 10,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        beliefs: true,
        preferences: true,
        birthYear: true,
        activeContext: true,
        lifeDestination: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { lifeEngineStreak: true },
    }),
    getWeekProgressStats(userId),
  ]);

  const persona = parseUserPersona(userRow ?? {});

  let activeContext: PersonaLayers["activeContext"] = null;
  if (userRow?.activeContext) {
    try {
      activeContext = JSON.parse(userRow.activeContext);
    } catch {
      /* ignore */
    }
  }

  const personaLayers: PersonaLayers = {
    userName,
    birthYear: userRow?.birthYear ?? null,
    beliefs: persona.beliefs,
    preferences: persona.preferences,
    activeContext,
    lifeDestination: userRow?.lifeDestination ?? null,
    graph: null,
    learnedToday: [],
    lifeEngineStreak: streakRow?.lifeEngineStreak ?? 0,
  };

  const voiceRecapFull = await buildVoiceWeeklyRecap(userId, weekStart, weekEnd);
  const voiceRecap = voiceRecapForWeeklyReview(voiceRecapFull);

  const momentsSource =
    lifeMomentsThisWeek.length > 0 ? lifeMomentsThisWeek : progressMomentsThisWeek;

  const avgGoalProgress =
    activeGoals.length > 0
      ? activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length
      : 0;

  const context: WeeklyReviewContext = {
    userName,
    tasksCompleted,
    activeGoals: activeGoals.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      progress: g.progress,
      status: g.status,
    })),
    momentsThisWeek: momentsSource.map((m) => ({ title: m.title })),
    pendingTasks: pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      isMission: t.isMission,
    })),
    goalsCompletedThisWeek,
    avgGoalProgress,
    preferences: persona.preferences,
    beliefs: persona.beliefs,
    lifeEngineStreak: streakRow?.lifeEngineStreak ?? 0,
    lifeXpGainedThisWeek: weekStats.lifeXpGained,
    coachingDaysCompleted: weekStats.coachingDaysCompleted,
    topXpDimensionLabel: weekStats.topXpDimension?.label ?? null,
    persona: personaLayers,
    voiceRecap,
  };

  const apiKey = (await isPremiumUser(userId)) ? getOpenAiApiKey() : null;
  let review = generateWeeklyReview(context);
  if (apiKey) {
    const { review: aiReview, usage } = await generateWeeklyReviewWithAI(context, apiKey);
    review = aiReview;
    await recordAiUsage(userId, "weekly_letter", usage);
  }

  const created = await prisma.weeklyReview.create({
    data: {
      userId,
      weekStart,
      tasksCompleted: review.tasksCompleted,
      wins: JSON.stringify(review.wins),
      focusAreas: JSON.stringify(review.focusAreas),
      goalsSummary: review.goalsSummary,
      summary: review.summary,
      letterBody: JSON.stringify(review.letterParagraphs),
    },
  });

  return { id: created.id, ...review, weekStats, voiceRecap: voiceRecapFull, aiGenerated: Boolean(apiKey), cached: false };
}

export async function getOrCreateMonthlyReview(userId: string, userName: string | null) {
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();

  const existing = await prisma.monthlyReview.findFirst({
    where: { userId, monthStart: { gte: monthStart, lt: monthEnd } },
  });

  if (existing) {
    return {
      id: existing.id,
      tasksCompleted: existing.tasksCompleted,
      goalsCompleted: existing.goalsCompleted,
      wins: JSON.parse(existing.wins) as string[],
      adjustments: JSON.parse(existing.adjustments) as string[],
      domainSummary: existing.domainSummary,
      summary: existing.summary,
      cached: true,
    };
  }

  const [tasksCompleted, goalsCompleted, activeGoals, completedGoals, momentsThisMonth] =
    await Promise.all([
      prisma.task.count({
        where: {
          userId,
          status: "DONE",
          completedAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.goal.count({
        where: {
          userId,
          status: "COMPLETED",
          updatedAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.goal.findMany({ where: { userId, status: "ACTIVE" } }),
      prisma.goal.findMany({
        where: {
          userId,
          status: "COMPLETED",
          updatedAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.progressMoment.findMany({
        where: { userId, createdAt: { gte: monthStart, lt: monthEnd } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const staleGoals = activeGoals.filter((g) => {
    const days = Math.floor((Date.now() - g.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 21;
  });

  const mapGoal = (g: (typeof activeGoals)[0]) => ({
    id: g.id,
    title: g.title,
    domain: g.domain,
    progress: g.progress,
    status: g.status,
  });

  const context: MonthlyReviewContext = {
    userName,
    tasksCompleted,
    goalsCompleted,
    activeGoals: activeGoals.map(mapGoal),
    completedGoals: completedGoals.map(mapGoal),
    staleGoals: staleGoals.map(mapGoal),
    momentsThisMonth: momentsThisMonth.map((m) => ({
      title: m.title,
      domain: m.domain,
    })),
  };

  const review = generateMonthlyReview(context);

  const created = await prisma.monthlyReview.create({
    data: {
      userId,
      monthStart,
      tasksCompleted: review.tasksCompleted,
      goalsCompleted: review.goalsCompleted,
      wins: JSON.stringify(review.wins),
      adjustments: JSON.stringify(review.adjustments),
      domainSummary: review.domainSummary,
      summary: review.summary,
    },
  });

  return { id: created.id, ...review, cached: false };
}

export async function getOrCreateQuarterlyReview(userId: string, userName: string | null) {
  const quarterStart = startOfQuarter();
  const quarterEnd = endOfQuarter();

  const existing = await prisma.quarterlyReview.findFirst({
    where: { userId, quarterStart: { gte: quarterStart, lt: quarterEnd } },
  });

  if (existing) {
    return {
      id: existing.id,
      tasksCompleted: existing.tasksCompleted,
      goalsCompleted: existing.goalsCompleted,
      wins: JSON.parse(existing.wins) as string[],
      priorities: JSON.parse(existing.priorities) as string[],
      domainSummary: existing.domainSummary,
      summary: existing.summary,
      cached: true,
    };
  }

  const [tasksCompleted, goalsCompleted, activeGoals, completedGoals, momentsThisQuarter, habits] =
    await Promise.all([
      prisma.task.count({
        where: {
          userId,
          status: "DONE",
          completedAt: { gte: quarterStart, lt: quarterEnd },
        },
      }),
      prisma.goal.count({
        where: {
          userId,
          status: "COMPLETED",
          updatedAt: { gte: quarterStart, lt: quarterEnd },
        },
      }),
      prisma.goal.findMany({ where: { userId, status: "ACTIVE" } }),
      prisma.goal.findMany({
        where: {
          userId,
          status: "COMPLETED",
          updatedAt: { gte: quarterStart, lt: quarterEnd },
        },
      }),
      prisma.progressMoment.findMany({
        where: { userId, createdAt: { gte: quarterStart, lt: quarterEnd } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.habit.findMany({
        where: { userId, active: true },
        orderBy: { streak: "desc" },
        take: 3,
      }),
    ]);

  const mapGoal = (g: (typeof activeGoals)[0]) => ({
    id: g.id,
    title: g.title,
    domain: g.domain,
    progress: g.progress,
    status: g.status,
  });

  const activeDomains = new Set(activeGoals.map((g) => g.domain));
  const allDomains: LifeDomain[] = [
    "CAREER",
    "MONEY",
    "HEALTH",
    "HABITS",
    "LEARNING",
    "RELATIONSHIPS",
    "PROJECTS",
  ];
  const neglectedDomains = allDomains.filter((d) => !activeDomains.has(d));

  const context: QuarterlyReviewContext = {
    userName,
    tasksCompleted,
    goalsCompleted,
    activeGoals: activeGoals.map(mapGoal),
    completedGoals: completedGoals.map(mapGoal),
    neglectedDomains,
    topHabitStreaks: habits.map((h) => ({ title: h.title, streak: h.streak })),
    momentsThisQuarter: momentsThisQuarter.map((m) => ({
      title: m.title,
      domain: m.domain,
    })),
  };

  const review = generateQuarterlyReview(context);

  const created = await prisma.quarterlyReview.create({
    data: {
      userId,
      quarterStart,
      tasksCompleted: review.tasksCompleted,
      goalsCompleted: review.goalsCompleted,
      wins: JSON.stringify(review.wins),
      priorities: JSON.stringify(review.priorities),
      domainSummary: review.domainSummary,
      summary: review.summary,
    },
  });

  return { id: created.id, ...review, cached: false };
}

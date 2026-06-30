import {
  LIFE_MODULES,
  type LifeFocusId,
  type LifeModuleId,
  type MissionItem,
  type MorningOperatingPayload,
} from "@forward/shared";
import { generateLifeNotices, generateHeroBriefing, generateScoreChangeReasons, generateLifePredictions, collectSuggestions } from "@forward/ai";
import { buildSuggestionContext } from "./forward";
import { getModuleNextSteps } from "./domain-next-action";
import { prisma } from "@forward/database";
import { buildBriefingContext, getOrCreateDailyBriefing, refreshSuggestions, getWeekProgressStats } from "./forward";
import { computeDomainScores, saveDailyScoreSnapshot } from "./life-scores";
import { startOfDay } from "./api";
import { getTimeOfDayGreeting } from "./generation";

const DOMAIN_TO_SCORE: Record<string, string> = {
  CAREER: "career",
  MONEY: "money",
  HEALTH: "health",
  LEARNING: "learning",
  RELATIONSHIPS: "relationships",
  HABITS: "mindset",
  PROJECTS: "career",
};

const SCORE_DOMAIN_LABEL: Record<string, string> = {
  career: "Career",
  money: "Money",
  health: "Health",
  learning: "Learning",
  relationships: "Relationships",
  mindset: "Mindset",
};

import { modulesFromFocuses } from "./life-os-client";
import { parseJsonArray } from "./life-os-parse";
import { sortModulesByOrder, applyContextModuleOrder } from "./module-order";
import { parseUserPersona, beliefCoachingHook } from "./user-persona";
import { getLifeGps } from "./life-gps";
import { getYesterdayVoiceBriefing } from "./voice-capture-processor";
import {
  buildAiCoachPrompt,
  buildIntegrationFeedItems,
  buildLifeFeed,
  buildLifeForecast,
  buildLifeTimeline,
  buildModuleCards,
} from "./life-intelligence";
import { getLifeGraph } from "./life-graph";
import { detectLifeContext, generateDailyLifeInsights } from "./life-intelligence-layer";
import { applyAdaptiveModules, parseModuleUsage } from "./adaptive-modules";
import { computeLifeEngineAction } from "./life-engine";
import { getLifeEngineStreak } from "./life-engine-streak";
import { buildLifeReplay, shouldShowLifeReplay } from "./life-replay";
import { computeRetirementGap } from "./retirement-gap";
import { parseAccountabilityPartner } from "./accountability-partner";
import { getLifeCircleMembers } from "./life-circle-server";
import { getLifeXpPayload } from "./life-xp";
import { getActiveCoachingLoops, ensureGoalCoachingLoops, pickTodayImprove } from "./adaptive-coaching";

function mapTaskDomain(goalDomain: string | null, title: string): string {
  if (goalDomain) {
    const key = DOMAIN_TO_SCORE[goalDomain];
    if (key) return key;
  }
  if (/pay|bill|save|budget|debt|visa|money|\$/i.test(title)) return "money";
  if (/workout|walk|run|gym|health|sleep|steps/i.test(title)) return "health";
  if (/read|learn|course|study/i.test(title)) return "learning";
  if (/call|mom|dad|family|friend|message/i.test(title)) return "relationships";
  if (/apply|job|interview|resume|career/i.test(title)) return "career";
  return "mindset";
}

export async function buildMissionItems(userId: string): Promise<MissionItem[]> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ["TODO", "IN_PROGRESS", "DONE"] } },
    include: { goal: { select: { domain: true } } },
    orderBy: [{ isMission: "desc" }, { priority: "desc" }, { dueDate: "asc" }],
    take: 12,
  });

  const today = startOfDay();
  const missionFirst = tasks.filter((t) => t.isMission || t.status !== "DONE");
  const pool = missionFirst.length > 0 ? missionFirst : tasks;

  const byDomain = new Map<string, (typeof tasks)[0]>();
  for (const t of pool) {
    const domain = mapTaskDomain(t.goal?.domain ?? null, t.title);
    if (!byDomain.has(domain)) byDomain.set(domain, t);
  }

  const items: MissionItem[] = [];
  for (const [domain, t] of byDomain) {
    if (items.length >= 5) break;
    items.push({
      id: t.id,
      title: t.title,
      domain,
      domainLabel: SCORE_DOMAIN_LABEL[domain] ?? domain,
      done: t.status === "DONE",
      isMission: t.isMission,
    });
  }

  if (items.length === 0) {
    const habits = await prisma.habit.findMany({
      where: { userId, active: true },
      take: 3,
    });
    for (const h of habits) {
      items.push({
        id: h.id,
        title: h.title,
        domain: "mindset",
        domainLabel: "Habits",
        done: h.lastDoneAt ? h.lastDoneAt >= today : false,
        isMission: false,
      });
    }
  }

  return items;
}

export async function getDailyOperatingSystem(userId: string, userName: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lifeFocuses: true,
      activeModules: true,
      moduleOrder: true,
      beliefs: true,
      preferences: true,
      activeContext: true,
      moduleUsage: true,
      accountabilityPartner: true,
      avatarUrl: true,
      dashboardTourSeenAt: true,
    },
  });

  const lifeFocuses = parseJsonArray<LifeFocusId>(user?.lifeFocuses);
  let activeModules = parseJsonArray<LifeModuleId>(user?.activeModules);
  if (activeModules.length === 0 && lifeFocuses.length > 0) {
    activeModules = modulesFromFocuses(lifeFocuses);
  }

  const persona = parseUserPersona(user ?? {});

  const [
    suggestions,
    missionItems,
    domainScores,
    lifeGps,
    activeContext,
    lifeGraph,
    lifeIntelligence,
    lifeEngineStreak,
    context,
  ] = await Promise.all([
    refreshSuggestions(userId),
    buildMissionItems(userId),
    computeDomainScores(userId),
    getLifeGps(userId),
    detectLifeContext(userId),
    getLifeGraph(userId),
    generateDailyLifeInsights(userId),
    getLifeEngineStreak(userId),
    buildBriefingContext(userId, userName),
  ]);

  await saveDailyScoreSnapshot(userId, domainScores);

  const completedTodayCount = missionItems.filter((m) => m.done).length;
  const pendingMission = missionItems.filter((m) => !m.done);

  const briefing = await getOrCreateDailyBriefing(userId, userName, {
    graph: lifeGraph,
    learnedToday: lifeIntelligence.learnedToday,
    lifeEngineStreak: lifeEngineStreak.currentStreak,
    completedToday: completedTodayCount,
    activeContext,
  });

  const habits = await prisma.habit.findMany({ where: { userId, active: true } });
  const moneyItems = await prisma.moneyItem.findMany({ where: { userId } });
  const applications = await prisma.jobApplication.findMany({ where: { userId } });

  const sleepHabit = habits.find((h) => /sleep|bed|rest/i.test(h.title));

  const notices = generateLifeNotices({
    userName,
    habits,
    moneyItems,
    applications,
    staleGoalCount: context.goals.filter((g) => g.status === "ACTIVE" && g.progress < 10).length,
    completedToday: completedTodayCount,
    sleepHabitStreak: sleepHabit?.streak,
    beliefs: persona.beliefs,
    preferences: persona.preferences,
    activeContext,
  });

  const careerProgressToday = missionItems.some(
    (m) => m.done && (m.domain === "career" || /apply|job|resume/i.test(m.title))
  );

  const hour = new Date().getHours();
  const hero = generateHeroBriefing({
    userName,
    hour,
    completedToday: completedTodayCount,
    pendingMission: pendingMission.map((m) => ({ title: m.title, domain: m.domain, id: m.id })),
    domainScores: {
      career: domainScores.career,
      overall: domainScores.overall,
      domainDeltas: domainScores.domainDeltas,
    },
    lifeGps: {
      destination: lifeGps.destination,
      percentComplete: lifeGps.percentComplete,
      etaLabel: lifeGps.etaLabel,
    },
    careerProgressToday,
    beliefs: persona.beliefs,
    preferences: persona.preferences,
    activeContext,
  });

  if (briefing.hero) {
    if (briefing.hero.dynamicOpening) hero.dynamicOpening = briefing.hero.dynamicOpening;
    if (briefing.hero.chiefOfStaffLine) hero.chiefOfStaffLine = briefing.hero.chiefOfStaffLine;
    if (briefing.hero.challengeLine !== undefined) hero.challengeLine = briefing.hero.challengeLine;
    if (briefing.hero.goodNews) hero.goodNews = briefing.hero.goodNews;
  }

  if (hour < 12) {
    const voiceBrief = await getYesterdayVoiceBriefing(userId);
    if (voiceBrief?.morningHook) {
      hero.dynamicOpening = voiceBrief.morningHook;
    }
    if (voiceBrief?.challengeFromVoice && !hero.challengeLine) {
      hero.challengeLine = voiceBrief.challengeFromVoice;
    }
    if (voiceBrief?.mood === "stressed" && voiceBrief.summary) {
      hero.chiefOfStaffLine = `Yesterday's reflection noted stress. ${hero.chiefOfStaffLine}`;
    }
  }

  const potentialScoreGain = hero.potentialScoreGain;
  const missionBonus = 7;
  const estimatedMinutes = hero.estimatedMinutes;

  const focus: string[] = [...briefing.priorities];
  for (const item of pendingMission.slice(0, 5)) {
    if (!focus.includes(item.title)) focus.push(item.title);
  }

  const insights = suggestions.slice(0, 3).map((s) => s.title);

  const firstName = userName?.split(" ")[0] ?? "there";
  const timeGreeting = getTimeOfDayGreeting(hour);

  const morning: MorningOperatingPayload = {
    greeting: `${timeGreeting}, ${firstName}.`,
    focus: focus.slice(0, 7),
    notices,
    insights,
    estimatedMinutes,
    potentialScoreGain,
    missionBonus,
    summary: briefing.summary,
    hero,
  };

  const scoreReasons = generateScoreChangeReasons(domainScores, completedTodayCount);

  const savingsItem = moneyItems.find((m) => m.type === "SAVINGS");
  const savingsProgress =
    savingsItem?.targetAmount && savingsItem.targetAmount > 0
      ? (savingsItem.currentAmount / savingsItem.targetAmount) * 100
      : 40;
  const workoutStreak = habits
    .filter((h) => /workout|walk|run|gym/i.test(h.title))
    .reduce((max, h) => Math.max(max, h.streak), 0);

  const [timeline, forecast, moduleNextSteps, suggestionContext] = await Promise.all([
    buildLifeTimeline(userId),
    buildLifeForecast(userId, lifeGps.destination),
    getModuleNextSteps(userId),
    buildSuggestionContext(userId),
  ]);

  const enrichedSuggestions = collectSuggestions(suggestionContext, { limit: 8 });
  const integrationFeed = buildIntegrationFeedItems(suggestionContext);
  const feed = buildLifeFeed(suggestions, enrichedSuggestions, applications, notices, integrationFeed);
  const predicts = generateLifePredictions({
    savingsProgress,
    savingsTarget: savingsItem?.targetAmount ?? null,
    workoutStreak,
    calendarBusyNextWeek: (context.calendarEvents?.length ?? 0) >= 4,
    month: new Date().getMonth(),
  });

  const moduleOrder = parseJsonArray<LifeModuleId>(user?.moduleOrder);
  const moduleUsage = parseModuleUsage(user?.moduleUsage);

  const [learningLatest, habitLatest, moneyLatest, careerLatest, relationshipsLatest] = await Promise.all([
    prisma.learningItem.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.habit.findFirst({ where: { userId, active: true }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.moneyItem.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.jobApplication.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.relationshipItem.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);

  const activitySignals = {
    learningUpdatedAt: learningLatest?.updatedAt ?? null,
    habitUpdatedAt: habitLatest?.updatedAt ?? null,
    moneyUpdatedAt: moneyLatest?.updatedAt ?? null,
    careerUpdatedAt: careerLatest?.updatedAt ?? null,
    relationshipsUpdatedAt: relationshipsLatest?.updatedAt ?? null,
  };

  const filtered = LIFE_MODULES.filter((m) =>
    activeModules.length === 0 ? true : activeModules.includes(m.id)
  );

  const contextOrdered = applyContextModuleOrder(
    sortModulesByOrder(filtered, moduleOrder),
    activeContext?.id
  );

  const { modules, hidden: hiddenModules, promoted: promotedModules } = applyAdaptiveModules(
    contextOrdered,
    moduleUsage,
    activitySignals
  );

  const moduleCards = buildModuleCards(modules, domainScores, {
    career: {
      title: moduleNextSteps.career.title,
      insight: moduleNextSteps.career.reason,
      actionLabel: moduleNextSteps.career.actionLabel,
      actionHref: moduleNextSteps.career.actionHref,
      entityId: moduleNextSteps.career.entityId,
    },
    money: {
      title: moduleNextSteps.money.title,
      insight: moduleNextSteps.money.reason,
      actionLabel: moduleNextSteps.money.actionLabel,
      actionHref: moduleNextSteps.money.actionHref,
      entityId: moduleNextSteps.money.entityId,
    },
    health: {
      title: moduleNextSteps.health.title,
      insight: moduleNextSteps.health.reason,
      actionLabel: moduleNextSteps.health.actionLabel,
      actionHref: moduleNextSteps.health.actionHref,
      entityId: moduleNextSteps.health.entityId,
    },
    learning: {
      title: moduleNextSteps.learning.title,
      insight: moduleNextSteps.learning.reason,
      actionLabel: moduleNextSteps.learning.actionLabel,
      actionHref: moduleNextSteps.learning.actionHref,
      entityId: moduleNextSteps.learning.entityId,
    },
    relationships: {
      title: moduleNextSteps.relationships.title,
      insight: moduleNextSteps.relationships.reason,
      actionLabel: moduleNextSteps.relationships.actionLabel,
      actionHref: moduleNextSteps.relationships.actionHref,
      entityId: moduleNextSteps.relationships.entityId,
    },
  });

  let aiCoach = buildAiCoachPrompt(
    pendingMission.map((m) => ({ title: m.title, domain: m.domain, id: m.id })),
    lifeGps,
    persona,
    activeContext
  );

  if (briefing.coach) {
    aiCoach = {
      ...aiCoach,
      prompt: briefing.coach.prompt,
      suggestion: briefing.coach.suggestion,
    };
  }

  const lifeEngine = computeLifeEngineAction({
    pendingMission: pendingMission.map((m) => ({ title: m.title, domain: m.domain, id: m.id })),
    moduleNextSteps,
    lifeGps,
    activeContext,
    persona,
    graph: lifeGraph,
    domainScores,
    promotedModules,
  });

  const rawReplay = await buildLifeReplay(userId);
  const lifeReplay = shouldShowLifeReplay() ? rawReplay : null;
  const retirementGap = await computeRetirementGap(userId);
  const lifeCircle = await getLifeCircleMembers(userId);
  const firstLinked = lifeCircle.find((m) => m.linkedUserId);
  const legacyPartner = parseAccountabilityPartner(user?.accountabilityPartner);
  const accountabilityPartner = firstLinked
    ? { name: firstLinked.displayName, linkedUserId: firstLinked.linkedUserId ?? undefined }
    : legacyPartner;
  const partnerActivity = firstLinked?.activity ?? null;
  await ensureGoalCoachingLoops(userId);
  const [lifeXp, coachingLoops, activeGoals, weekStats] = await Promise.all([
    getLifeXpPayload(userId),
    getActiveCoachingLoops(userId),
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, title: true },
    }),
    getWeekProgressStats(userId),
  ]);
  const todayImproveRaw = pickTodayImprove(coachingLoops, new Map(activeGoals.map((g) => [g.id, g.title])));
  const todayImprove = todayImproveRaw
    ? {
        ...todayImproveRaw,
        beliefHook: beliefCoachingHook(persona, todayImproveRaw.module),
      }
    : null;

  return {
    lifeFocuses,
    activeModules,
    moduleOrder,
    needsLifeFocus: lifeFocuses.length === 0,
    needsDashboardTour: lifeFocuses.length > 0 && !user?.dashboardTourSeenAt,
    userName,
    userAvatarUrl: user?.avatarUrl ?? null,
    morning,
    domainScores,
    scoreReasons,
    missionItems,
    modules,
    moduleCards,
    lifeGps,
    timeline,
    forecast,
    feed,
    predicts,
    aiCoach,
    suggestions,
    lifeGraph,
    lifeIntelligence,
    activeContext,
    beliefs: persona.beliefs,
    preferences: persona.preferences,
    lifeEngine,
    lifeEngineStreak,
    lifeReplay,
    retirementGap,
    accountabilityPartner,
    partnerActivity,
    lifeCircle,
    lifeXp,
    coachingLoops,
    todayImprove,
    weekStats,
    hiddenModules,
    promotedModules,
  };
}

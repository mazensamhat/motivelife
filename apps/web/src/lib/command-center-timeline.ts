import { prisma } from "@forward/database";
import type {
  CommandCenterTimelineBlock,
  CommandCenterTimelinePayload,
  HeroBriefing,
  LifeArea,
  MissionItem,
} from "@forward/shared";
import { estimateActionReward } from "@/lib/action-rewards";
import {
  computeCalendarWorkload,
  getCalendarEvents,
} from "@/lib/calendar-events";
import { getCalendarConnectionStatus } from "@/lib/calendar-connection";
import { buildAutoPilotProposals } from "@/lib/auto-pilot-proposals";
import { computeEnergyCurve, computeWeeklyHeatMap } from "@/lib/calendar-energy";
import { getGoogleCalendarEvents } from "@/lib/google-calendar";
import {
  classifyCalendarEvent,
  enrichCalendarEventCoaching,
  parseApplicationPrep,
  type EventIntelligenceContext,
} from "@/lib/event-intelligence";
import { getLifeCircleMembers } from "@/lib/life-circle-server";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const MIN_FREE_GAP_MS = 45 * 60 * 1000;

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function atToday(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function missionLifeArea(domain: string): LifeArea {
  if (domain === "mindset") return "mindset";
  if (["career", "health", "money", "relationships", "learning"].includes(domain)) {
    return domain as LifeArea;
  }
  return "career";
}

function missionKind(mission: MissionItem): "task" | "habit" {
  return mission.domainLabel === "Habits" && !mission.isMission ? "habit" : "task";
}

function missionEmoji(domain: string): string {
  const map: Record<string, string> = {
    career: "💼",
    health: "❤️",
    money: "💰",
    learning: "📚",
    relationships: "👥",
    mindset: "🧠",
  };
  return map[domain] ?? "🎯";
}

function computeSuccessProbability(
  overallScore: number,
  completedToday: number,
  pendingCount: number,
  calendarConnected: boolean
): number {
  let p = overallScore;
  if (completedToday > 0) p += Math.min(12, completedToday * 4);
  if (pendingCount <= 2) p += 5;
  if (pendingCount >= 5) p -= 8;
  if (calendarConnected) p += 4;
  return Math.round(Math.min(97, Math.max(52, p)));
}

function inferTodayFocus(
  hero: HeroBriefing,
  pendingMissions: MissionItem[]
): string {
  if (hero.dayAssessment) {
    const short = hero.dayAssessment.split("—")[0]?.trim() ?? hero.dayAssessment;
    if (short.length <= 48) return short;
    return short.slice(0, 45) + "…";
  }
  const top = pendingMissions.find((m) => !m.done);
  if (top) return top.domainLabel;
  return "Balance";
}

export async function buildCommandCenterTimeline(input: {
  userId: string;
  missionItems: MissionItem[];
  overallScore: number;
  completedToday: number;
  hero: HeroBriefing;
  lifeEngineStreak?: number;
}): Promise<CommandCenterTimelinePayload> {
  const { userId, missionItems, overallScore, completedToday, hero } = input;

  const calendarStatus = await getCalendarConnectionStatus(userId);
  const calendarConnected = calendarStatus.anyConnected;
  const calendarConfigured = calendarStatus.google.configured;

  const pendingMissions = missionItems.filter((m) => !m.done);
  const todayFocus = inferTodayFocus(hero, pendingMissions);
  const successProbability = computeSuccessProbability(
    overallScore,
    completedToday,
    pendingMissions.length,
    calendarConnected
  );

  const [habits, lifeCircle, applicationsRaw, healthItems] = await Promise.all([
    prisma.habit.findMany({
      where: { userId, active: true },
      select: { title: true, streak: true, lastDoneAt: true },
    }),
    getLifeCircleMembers(userId),
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        company: true,
        role: true,
        status: true,
        interviewAt: true,
        prepChecklist: true,
        nextStep: true,
      },
    }),
    prisma.healthItem.findMany({
      where: { userId },
      take: 10,
      select: { title: true, type: true },
    }),
  ]);
  const gymHabit = habits.find((h) => /gym|workout|fitness|exercise/i.test(h.title));
  const gymStreakBehind = Boolean(gymHabit && gymHabit.streak < 2);

  const intelligenceCtx: EventIntelligenceContext = {
    lifeCircle,
    applications: applicationsRaw.map((a) => ({
      company: a.company,
      role: a.role,
      status: a.status,
      interviewAt: a.interviewAt,
      prepChecklist: parseApplicationPrep(a.prepChecklist),
      nextStep: a.nextStep,
    })),
    healthItems: healthItems.map((h) => ({ title: h.title, type: h.type })),
    gymStreak: gymHabit?.streak ?? null,
    gymStreakBehind,
  };

  const now = new Date();
  const hour = now.getHours();
  const blocks: CommandCenterTimelineBlock[] = [];
  const usedMissionIds = new Set<string>();

  const briefStart = atToday(7, 30);
  if (hour < 11) {
    blocks.push({
      id: "brief-morning",
      kind: "brief",
      timeLabel: hour < 8 ? formatTime(briefStart) : "Now",
      startIso: (hour < 8 ? briefStart : now).toISOString(),
      title: "Morning Brief",
      emoji: "☀️",
      lifeArea: "mindset",
      coaching: {
        headline: hero.chiefOfStaffLine || hero.dynamicOpening || "Today is yours to shape.",
        subline: hero.dayAssessment,
        scoreImpact: hero.potentialScoreGain,
      },
    });
  }

  let calendarEvents: Awaited<ReturnType<typeof getCalendarEvents>> = [];
  let googleEvents: Awaited<ReturnType<typeof getGoogleCalendarEvents>> = [];
  if (calendarConnected) {
    [calendarEvents, googleEvents] = await Promise.all([
      getCalendarEvents(userId, 7).catch(() => []),
      getGoogleCalendarEvents(userId, 7).catch(() => []),
    ]);
  }

  const workload = {
    today: computeCalendarWorkload(calendarEvents, 0),
    tomorrow: computeCalendarWorkload(calendarEvents, 1),
  };

  const todayStart = atToday(DAY_START_HOUR);
  const todayEnd = atToday(DAY_END_HOUR);
  const todayEvents = calendarEvents
    .filter((e) => e.start >= todayStart && e.start <= todayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const event of todayEvents) {
    const { lifeArea, eventType } = classifyCalendarEvent(event.title);
    const coaching = enrichCalendarEventCoaching(
      event.title,
      eventType,
      event.start,
      intelligenceCtx
    );
    blocks.push({
      id: `cal-${event.start.getTime()}-${event.title.slice(0, 12)}`,
      kind: "calendar",
      timeLabel: formatTime(event.start),
      startIso: event.start.toISOString(),
      endIso: event.end.toISOString(),
      title: event.title,
      subtitle:
        event.sources.length > 1
          ? `${event.sources.map((s) => (s === "google" ? "Google" : "Apple")).join(" + ")}`
          : event.source === "apple"
            ? "Apple Calendar"
            : undefined,
      emoji:
        eventType === "gym"
          ? "🏋️"
          : eventType === "doctor"
            ? "🩺"
            : eventType === "lunch"
              ? "🍽"
              : eventType === "interview"
                ? "📅"
                : "📅",
      lifeArea,
      coaching,
    });
  }

  const timelineAnchors: { start: Date; end: Date }[] = todayEvents.map((e) => ({
    start: e.start,
    end: e.end,
  }));

  function suggestMission(): MissionItem | undefined {
    return pendingMissions.find((m) => !usedMissionIds.has(m.id));
  }

  function addFreeBlock(gapStart: Date, gapEnd: Date) {
    const durationMs = gapEnd.getTime() - gapStart.getTime();
    if (durationMs < MIN_FREE_GAP_MS) return;
    const mission = suggestMission();
    const durationMin = Math.round(durationMs / 60000);
    if (mission) {
      usedMissionIds.add(mission.id);
      const area = missionLifeArea(mission.domain);
      blocks.push({
        id: `free-${gapStart.getTime()}`,
        kind: "free",
        timeLabel: formatTime(gapStart),
        startIso: gapStart.toISOString(),
        endIso: gapEnd.toISOString(),
        title: `${Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)}h ` : ""}${durationMin % 60 || durationMin}m free`,
        emoji: "✨",
        lifeArea: area,
        missionId: mission.id,
        missionKind: missionKind(mission),
        coaching: {
          headline: "Excellent opportunity — highest-impact move right now:",
          subline: mission.title,
          scoreImpact: estimateActionReward(mission.title, mission.domain),
          eventType: "generic",
        },
      });
    } else {
      blocks.push({
        id: `free-${gapStart.getTime()}`,
        kind: "free",
        timeLabel: formatTime(gapStart),
        startIso: gapStart.toISOString(),
        endIso: gapEnd.toISOString(),
        title: "Open time",
        emoji: "✨",
        lifeArea: "mindset",
        coaching: {
          headline: "Open window — protect it for deep work or recovery.",
          scoreImpact: 2,
        },
      });
    }
  }

  if (todayEvents.length === 0) {
    const missionSlots = [
      atToday(9, 0),
      atToday(14, 0),
      atToday(16, 30),
    ];
    for (const slot of missionSlots) {
      if (slot < now && hour > slot.getHours()) continue;
      const mission = suggestMission();
      if (!mission) break;
      usedMissionIds.add(mission.id);
      blocks.push({
        id: `mission-${mission.id}`,
        kind: "mission",
        timeLabel: slot <= now ? "Up next" : formatTime(slot),
        startIso: slot.toISOString(),
        title: mission.title,
        subtitle: "Today's mission",
        emoji: missionEmoji(mission.domain),
        lifeArea: missionLifeArea(mission.domain),
        missionId: mission.id,
        missionKind: missionKind(mission),
        done: mission.done,
        coaching: {
          headline: mission.isMission ? "Your priority action for today." : "Suggested focus block.",
          scoreImpact: estimateActionReward(mission.title, mission.domain),
        },
      });
    }
  } else {
    let cursor = todayStart;
    for (const event of timelineAnchors) {
      if (event.start.getTime() - cursor.getTime() >= MIN_FREE_GAP_MS) {
        addFreeBlock(new Date(cursor), new Date(event.start));
      }
      cursor = event.end > cursor ? event.end : cursor;
    }
    if (todayEnd.getTime() - cursor.getTime() >= MIN_FREE_GAP_MS) {
      addFreeBlock(new Date(cursor), todayEnd);
    }
  }

  for (const mission of pendingMissions) {
    if (usedMissionIds.has(mission.id)) continue;
    usedMissionIds.add(mission.id);
    blocks.push({
      id: `mission-${mission.id}`,
      kind: "suggested",
      timeLabel: "Flexible",
      startIso: atToday(15, 0).toISOString(),
      title: mission.title,
      subtitle: "Suggested today",
      emoji: missionEmoji(mission.domain),
      lifeArea: missionLifeArea(mission.domain),
      missionId: mission.id,
      missionKind: missionKind(mission),
      coaching: {
        headline: "Fits your goals — schedule when you have focus.",
        scoreImpact: estimateActionReward(mission.title, mission.domain),
      },
    });
  }

  const reflectionStart = atToday(20, 30);
  if (hour < 22) {
    blocks.push({
      id: "reflection-evening",
      kind: "reflection",
      timeLabel: formatTime(reflectionStart),
      startIso: reflectionStart.toISOString(),
      title: "Daily Reflection",
      emoji: "🌙",
      lifeArea: "mindset",
      coaching: {
        headline: "Close the loop — capture wins and set tomorrow's intent.",
        scoreImpact: 2,
      },
    });
  }

  blocks.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const tomorrowEvents = calendarEvents
    .filter((e) => e.start >= tomorrowStart && e.start <= tomorrowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let tomorrowHighlight: CommandCenterTimelinePayload["tomorrowHighlight"];
  const tomorrowPick =
    tomorrowEvents.find((e) => /interview|review|presentation/i.test(e.title)) ??
    tomorrowEvents[0];
  if (tomorrowPick) {
    const { lifeArea, eventType } = classifyCalendarEvent(tomorrowPick.title);
    const tomorrowCoaching = enrichCalendarEventCoaching(
      tomorrowPick.title,
      eventType,
      tomorrowPick.start,
      intelligenceCtx
    );
    tomorrowHighlight = {
      title: tomorrowPick.title,
      prepPercent: tomorrowCoaching.intelligence?.prepPercent ?? 60,
      lifeArea,
      eventType,
    };
  }

  const autoPilotProposals = calendarConnected
    ? buildAutoPilotProposals({
        missions: pendingMissions,
        calendarEvents,
        googleEvents,
        googleWriteEnabled: calendarStatus.google.writeEnabled,
        workloadTomorrow: workload.tomorrow,
      })
    : [];

  const energyCurve = calendarConnected ? computeEnergyCurve(calendarEvents, 0) : undefined;
  const weeklyHeatMap = calendarConnected ? computeWeeklyHeatMap(calendarEvents) : undefined;

  return {
    calendarConnected,
    calendarConfigured,
    calendarSources: {
      google: calendarStatus.google.connected,
      apple: calendarStatus.apple.connected,
    },
    todayFocus,
    successProbability,
    workload,
    blocks,
    tomorrowHighlight,
    autoPilot: calendarConnected
      ? {
          enabled: true,
          writeEnabled: calendarStatus.google.writeEnabled,
          proposals: autoPilotProposals,
        }
      : undefined,
    energyCurve,
    weeklyHeatMap,
  };
}

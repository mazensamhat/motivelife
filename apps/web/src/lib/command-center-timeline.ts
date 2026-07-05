import { prisma } from "@forward/database";
import type {
  CommandCenterTimelineBlock,
  CommandCenterTimelinePayload,
  HeroBriefing,
  LifeArea,
  MissionItem,
  TimelineEventType,
  TimelinePrepItem,
} from "@forward/shared";
import { estimateActionReward } from "@/lib/action-rewards";
import {
  getGoogleCalendarEvents,
  isGoogleCalendarConnected,
  isGoogleConfigured,
} from "@/lib/google-calendar";

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

function classifyEvent(title: string): { lifeArea: LifeArea; eventType: TimelineEventType } {
  const t = title.toLowerCase();
  if (/interview|screening|recruiter|hiring/i.test(t)) {
    return { lifeArea: "career", eventType: "interview" };
  }
  if (/gym|workout|fitness|\brun\b|yoga|lift/i.test(t)) {
    return { lifeArea: "health", eventType: "gym" };
  }
  if (/doctor|dentist|therapy|medical|checkup|physio/i.test(t)) {
    return { lifeArea: "health", eventType: "doctor" };
  }
  if (/lunch|dinner|breakfast|brunch|coffee|meal/i.test(t)) {
    return { lifeArea: "relationships", eventType: "lunch" };
  }
  if (/birthday|anniversary/i.test(t)) {
    return { lifeArea: "relationships", eventType: "birthday" };
  }
  if (/vacation|flight|trip|travel|airport|pto/i.test(t)) {
    return { lifeArea: "home", eventType: "travel" };
  }
  if (/review|1:1|standup|meeting|sync|call|presentation/i.test(t)) {
    return { lifeArea: "career", eventType: "meeting" };
  }
  if (/budget|bank|invest|tax|finance/i.test(t)) {
    return { lifeArea: "money", eventType: "generic" };
  }
  if (/learn|class|course|study|workshop/i.test(t)) {
    return { lifeArea: "learning", eventType: "generic" };
  }
  return { lifeArea: "career", eventType: "generic" };
}

function coachingForEvent(
  title: string,
  eventType: TimelineEventType,
  lifeArea: LifeArea,
  gymStreakBehind?: boolean
): { headline: string; subline?: string; prepItems?: TimelinePrepItem[]; aiBriefReady?: boolean; scoreImpact: number } {
  switch (eventType) {
    case "interview":
      return {
        headline: "Interview prep — your AI brief is ready.",
        subline: "Review materials before you go in confident.",
        prepItems: [
          { label: "Review last report / portfolio", done: false },
          { label: "Open your notes", done: false },
          { label: "Research the company (5 min)", done: false },
        ],
        aiBriefReady: true,
        scoreImpact: 4,
      };
    case "gym":
      return {
        headline: gymStreakBehind
          ? "You're behind on workouts — completing today restores momentum."
          : "Movement today protects your energy and focus.",
        subline: "AI recommends a moderate session based on your schedule.",
        scoreImpact: 5,
      };
    case "doctor":
      return {
        headline: "Health appointment — bring your questions.",
        prepItems: [
          { label: "List medications & symptoms", done: false },
          { label: "Insurance card ready", done: false },
        ],
        scoreImpact: 3,
      };
    case "lunch":
      return {
        headline: "AI suggestion: 15-minute walk afterwards.",
        subline: "Light movement after eating supports focus this afternoon.",
        scoreImpact: 2,
      };
    case "birthday":
      return {
        headline: "Gift ideas and reminder ready in your relationship layer.",
        scoreImpact: 2,
      };
    case "travel":
      return {
        headline: "Trip coming up — packing and logistics checklist available.",
        scoreImpact: 2,
      };
    case "meeting":
      return {
        headline: /performance|review|promotion/i.test(title)
          ? "Career-focused day — prep your wins and talking points."
          : "Meeting brief: review agenda and open action items.",
        prepItems: [
          { label: "Review agenda / last notes", done: false },
          { label: "Clarify your desired outcome", done: false },
        ],
        aiBriefReady: /review|1:1|performance/i.test(title),
        scoreImpact: 2,
      };
    default:
      return {
        headline: "Protected time on your calendar — treat it intentionally.",
        scoreImpact: estimateActionReward(title, lifeArea),
      };
  }
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

  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
  });
  const calendarConnected = Boolean(integration && isGoogleCalendarConnected(integration.scope));
  const calendarConfigured = isGoogleConfigured();

  const pendingMissions = missionItems.filter((m) => !m.done);
  const todayFocus = inferTodayFocus(hero, pendingMissions);
  const successProbability = computeSuccessProbability(
    overallScore,
    completedToday,
    pendingMissions.length,
    calendarConnected
  );

  const habits = await prisma.habit.findMany({
    where: { userId, active: true },
    select: { title: true, streak: true, lastDoneAt: true },
  });
  const gymHabit = habits.find((h) => /gym|workout|fitness|exercise/i.test(h.title));
  const gymStreakBehind = Boolean(gymHabit && gymHabit.streak < 2);

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

  let calendarEvents: { title: string; start: Date; end: Date }[] = [];
  if (calendarConnected) {
    calendarEvents = await getGoogleCalendarEvents(userId, 2).catch(() => []);
  }

  const todayStart = atToday(DAY_START_HOUR);
  const todayEnd = atToday(DAY_END_HOUR);
  const todayEvents = calendarEvents
    .filter((e) => e.start >= todayStart && e.start <= todayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const event of todayEvents) {
    const { lifeArea, eventType } = classifyEvent(event.title);
    const coaching = coachingForEvent(event.title, eventType, lifeArea, gymStreakBehind);
    blocks.push({
      id: `cal-${event.start.getTime()}-${event.title.slice(0, 12)}`,
      kind: "calendar",
      timeLabel: formatTime(event.start),
      startIso: event.start.toISOString(),
      endIso: event.end.toISOString(),
      title: event.title,
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
      coaching: { ...coaching, eventType },
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
    const { lifeArea, eventType } = classifyEvent(tomorrowPick.title);
    tomorrowHighlight = {
      title: tomorrowPick.title,
      prepPercent: eventType === "interview" ? 72 : eventType === "meeting" ? 85 : 60,
      lifeArea,
      eventType,
    };
  }

  return {
    calendarConnected,
    calendarConfigured,
    todayFocus,
    successProbability,
    blocks,
    tomorrowHighlight,
  };
}

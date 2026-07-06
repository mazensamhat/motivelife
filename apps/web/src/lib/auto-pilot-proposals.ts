import type {
  AutoPilotProposal,
  CalendarWorkloadDay,
  LifeArea,
  MissionItem,
} from "@forward/shared";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import type { UnifiedCalendarEvent } from "@/lib/calendar-events";
import { classifyCalendarEvent } from "@/lib/event-intelligence";

const AWAKE_START_HOUR = 7;
const AWAKE_END_HOUR = 22;
const MIN_BLOCK_MS = 45 * 60 * 1000;
const DEFAULT_BLOCK_MS = 60 * 60 * 1000;

function atDayOffset(hour: number, minute: number, dayOffset: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

function missionLifeArea(domain: string): LifeArea {
  if (domain === "mindset") return "mindset";
  if (["career", "health", "money", "relationships", "learning"].includes(domain)) {
    return domain as LifeArea;
  }
  return "career";
}

export function findFreeSlots(
  events: { start: Date; end: Date }[],
  dayOffset: number,
  minDurationMs = MIN_BLOCK_MS
): { start: Date; end: Date }[] {
  const windowStart = atDayOffset(AWAKE_START_HOUR, 0, dayOffset);
  const windowEnd = atDayOffset(AWAKE_END_HOUR, 0, dayOffset);
  const dayStart = atDayOffset(0, 0, dayOffset);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const now = new Date();
  const sorted = events
    .filter((e) => e.start >= dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots: { start: Date; end: Date }[] = [];
  let cursor = windowStart.getTime() < now.getTime() && dayOffset === 0 ? now.getTime() : windowStart.getTime();

  for (const event of sorted) {
    const gapEnd = Math.min(event.start.getTime(), windowEnd.getTime());
    if (gapEnd - cursor >= minDurationMs) {
      slots.push({ start: new Date(cursor), end: new Date(gapEnd) });
    }
    cursor = Math.max(cursor, event.end.getTime());
  }

  if (windowEnd.getTime() - cursor >= minDurationMs) {
    slots.push({ start: new Date(cursor), end: new Date(windowEnd) });
  }

  return slots;
}

function slotHour(slot: { start: Date }) {
  return slot.start.getHours() + slot.start.getMinutes() / 60;
}

/** Prefer morning for prep, mid-day for deep work, late afternoon for lighter blocks. */
function scoreSlot(
  slot: { start: Date; end: Date },
  preference: "prep" | "mission" | "flex"
): number {
  const hour = slotHour(slot);
  const durationH = (slot.end.getTime() - slot.start.getTime()) / 3600000;
  let score = durationH;

  if (preference === "prep") {
    if (hour >= 8 && hour <= 11) score += 3;
    else if (hour >= 14 && hour <= 16) score += 1;
  } else if (preference === "mission") {
    if (hour >= 9 && hour <= 12) score += 2;
    if (hour >= 14 && hour <= 16) score += 1.5;
  } else if (preference === "flex") {
    if (hour >= 10 && hour <= 15) score += 1;
  }

  return score;
}

function pickSlot(
  slots: { start: Date; end: Date }[],
  durationMs: number,
  preference: "prep" | "mission" | "flex" = "mission"
): { start: Date; end: Date } | null {
  let best: { start: Date; end: Date } | null = null;
  let bestScore = -1;

  for (const slot of slots) {
    const available = slot.end.getTime() - slot.start.getTime();
    if (available < durationMs) continue;
    const candidate = {
      start: slot.start,
      end: new Date(slot.start.getTime() + durationMs),
    };
    const s = scoreSlot(candidate, preference);
    if (s > bestScore) {
      bestScore = s;
      best = candidate;
    }
  }

  return best;
}

function matchGoogleEvent(
  keyword: string,
  events: GoogleCalendarEvent[]
): GoogleCalendarEvent | null {
  const needle = keyword.toLowerCase();
  return (
    events.find((e) => e.title.toLowerCase().includes(needle)) ??
    events.find((e) => needle.includes(e.title.toLowerCase().slice(0, 8))) ??
    null
  );
}

function sortProposals(proposals: AutoPilotProposal[]): AutoPilotProposal[] {
  return [...proposals].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function buildAutoPilotProposals(input: {
  missions: MissionItem[];
  calendarEvents: UnifiedCalendarEvent[];
  googleEvents: GoogleCalendarEvent[];
  googleWriteEnabled: boolean;
  workloadTomorrow: CalendarWorkloadDay;
}): AutoPilotProposal[] {
  const { missions, calendarEvents, googleEvents, googleWriteEnabled, workloadTomorrow } = input;
  const proposals: AutoPilotProposal[] = [];
  const usedSlots = new Set<string>();

  const todayAnchors = calendarEvents.map((e) => ({ start: e.start, end: e.end }));
  const todaySlots = findFreeSlots(todayAnchors, 0);
  const pending = missions.filter((m) => !m.done);

  const tomorrowStart = atDayOffset(0, 0, 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const tomorrowInterview = calendarEvents.find(
    (e) =>
      e.start >= tomorrowStart &&
      e.start < tomorrowEnd &&
      /interview|screening|presentation/i.test(e.title)
  );

  if (tomorrowInterview) {
    const prepSlot = pickSlot(
      todaySlots.filter((s) => !usedSlots.has(s.start.toISOString())),
      45 * 60 * 1000,
      "prep"
    );
    if (prepSlot) {
      usedSlots.add(prepSlot.start.toISOString());
      const { lifeArea } = classifyCalendarEvent(tomorrowInterview.title);
      proposals.push({
        id: `prep-${tomorrowInterview.start.getTime()}`,
        kind: "prep_block",
        title: `Prep: ${tomorrowInterview.title}`,
        reason: "Block focused prep time before tomorrow's high-stakes event.",
        startIso: prepSlot.start.toISOString(),
        endIso: prepSlot.end.toISOString(),
        lifeArea,
        canAccept: googleWriteEnabled,
        priority: 95,
        priorityLabel: "High stakes",
      });
    }
  }

  if (workloadTomorrow.percent >= 88 && googleEvents.length > 0) {
    const movable = googleEvents.find(
      (e) =>
        e.id &&
        e.start.getTime() > Date.now() &&
        /gym|workout|focus|deep work|walk|lunch/i.test(e.title)
    );
    const targetSlots = findFreeSlots(todayAnchors, 1);
    const target = pickSlot(targetSlots, DEFAULT_BLOCK_MS, "flex");

    if (movable?.id && target) {
      proposals.push({
        id: `reschedule-${movable.id}`,
        kind: "reschedule",
        title: movable.title,
        reason: "Tomorrow is overloaded — shift this block to a lighter window.",
        startIso: target.start.toISOString(),
        endIso: target.end.toISOString(),
        lifeArea: classifyCalendarEvent(movable.title).lifeArea,
        googleEventId: movable.id,
        canAccept: googleWriteEnabled,
        priority: 80,
        priorityLabel: "Overload relief",
      });
    }
  }

  for (const mission of pending.slice(0, 2)) {
    const slot = pickSlot(
      todaySlots.filter((s) => !usedSlots.has(s.start.toISOString())),
      DEFAULT_BLOCK_MS,
      "mission"
    );
    if (!slot) break;
    const slotKey = slot.start.toISOString();
    if (usedSlots.has(slotKey)) continue;
    usedSlots.add(slotKey);

    proposals.push({
      id: `mission-${mission.id}-${slotKey}`,
      kind: "block_mission",
      title: mission.title,
      reason: "Highest-impact mission fits this open window on your calendar.",
      startIso: slot.start.toISOString(),
      endIso: slot.end.toISOString(),
      lifeArea: missionLifeArea(mission.domain),
      missionId: mission.id,
      canAccept: googleWriteEnabled,
      priority: 60,
      priorityLabel: "Mission block",
    });
  }

  if (proposals.length === 0 && todaySlots.length > 0) {
    const slot = pickSlot(todaySlots, 30 * 60 * 1000, "flex");
    if (slot) {
      proposals.push({
        id: `focus-${slot.start.toISOString()}`,
        kind: "block_mission",
        title: "Protected focus block",
        reason: "You have open time — block it before something else fills the gap.",
        startIso: slot.start.toISOString(),
        endIso: slot.end.toISOString(),
        lifeArea: "mindset",
        canAccept: googleWriteEnabled,
        priority: 40,
        priorityLabel: "Focus",
      });
    }
  }

  return sortProposals(proposals).slice(0, 4);
}

export function buildRescheduleProposal(input: {
  keyword: string;
  targetStart: Date;
  durationMs: number;
  googleEvents: GoogleCalendarEvent[];
  calendarEvents: UnifiedCalendarEvent[];
  googleWriteEnabled: boolean;
}): AutoPilotProposal | null {
  const event = matchGoogleEvent(input.keyword, input.googleEvents);
  if (!event?.id) return null;

  const durationMs = input.durationMs || Math.max(MIN_BLOCK_MS, event.end.getTime() - event.start.getTime());
  const end = new Date(input.targetStart.getTime() + durationMs);

  return {
    id: `voice-reschedule-${event.id}-${input.targetStart.getTime()}`,
    kind: "reschedule",
    title: event.title,
    reason: "Voice reschedule — confirm to update Google Calendar.",
    startIso: input.targetStart.toISOString(),
    endIso: end.toISOString(),
    lifeArea: classifyCalendarEvent(event.title).lifeArea,
    googleEventId: event.id,
    canAccept: input.googleWriteEnabled,
    priority: 70,
    priorityLabel: "Voice request",
  };
}

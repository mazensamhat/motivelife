import type { CalendarEventSource, CalendarWorkloadDay } from "@forward/shared";
import { getGoogleCalendarEvents } from "@/lib/google-calendar";
import { getAppleCalendarEvents } from "@/lib/apple-caldav";

export type UnifiedCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: CalendarEventSource;
  sources: CalendarEventSource[];
  /** Present when the event lives on Google Calendar — used for voice reschedule. */
  googleEventId?: string;
};

const AWAKE_START_HOUR = 7;
const AWAKE_END_HOUR = 22;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function eventsAreDuplicates(a: UnifiedCalendarEvent, b: UnifiedCalendarEvent): boolean {
  if (normalizeTitle(a.title) !== normalizeTitle(b.title)) return false;
  const startDiff = Math.abs(a.start.getTime() - b.start.getTime());
  return startDiff < 5 * 60 * 1000;
}

export function dedupeCalendarEvents(events: UnifiedCalendarEvent[]): UnifiedCalendarEvent[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: UnifiedCalendarEvent[] = [];

  for (const event of sorted) {
    const existing = merged.find((m) => eventsAreDuplicates(m, event));
    if (existing) {
      if (!existing.sources.includes(event.source)) {
        existing.sources.push(event.source);
      }
      continue;
    }
    merged.push({ ...event, sources: [event.source] });
  }

  return merged;
}

function dayWindow(dayOffset: number) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() + dayOffset);

  const windowStart = new Date(dayStart);
  windowStart.setHours(AWAKE_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(dayStart);
  windowEnd.setHours(AWAKE_END_HOUR, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return { dayStart, dayEnd, windowStart, windowEnd };
}

export function computeCalendarWorkload(
  events: UnifiedCalendarEvent[],
  dayOffset = 0
): CalendarWorkloadDay {
  const { dayStart, dayEnd, windowStart, windowEnd } = dayWindow(dayOffset);
  const availableMs = windowEnd.getTime() - windowStart.getTime();

  const dayEvents = events.filter((e) => e.start >= dayStart && e.start < dayEnd);

  let busyMs = 0;
  for (const event of dayEvents) {
    const start = Math.max(event.start.getTime(), windowStart.getTime());
    const end = Math.min(event.end.getTime(), windowEnd.getTime());
    if (end > start) busyMs += end - start;
  }

  const percent = Math.round(Math.min(100, (busyMs / availableMs) * 100));
  const label =
    percent >= 90 ? "Overloaded" : percent >= 72 ? "Heavy day" : "Healthy workload";
  const recommendation =
    percent >= 90
      ? "Consider moving or shortening one block tomorrow."
      : percent >= 72
        ? "Protect breaks — back-to-back time adds up."
        : undefined;

  return { percent, label, recommendation };
}

export async function getCalendarEvents(userId: string, days = 2): Promise<UnifiedCalendarEvent[]> {
  const [googleEvents, appleEvents] = await Promise.all([
    getGoogleCalendarEvents(userId, days).catch(() => []),
    getAppleCalendarEvents(userId, days).catch(() => []),
  ]);

  const unified: UnifiedCalendarEvent[] = [
    ...googleEvents.map((e) => ({
      id: e.id ? `google-${e.id}` : `google-${e.start.getTime()}-${normalizeTitle(e.title).slice(0, 24)}`,
      title: e.title,
      start: e.start,
      end: e.end,
      source: "google" as const,
      sources: ["google" as const],
      googleEventId: e.id,
    })),
    ...appleEvents.map((e) => ({
      id: `apple-${e.start.getTime()}-${normalizeTitle(e.title).slice(0, 24)}`,
      title: e.title,
      start: e.start,
      end: e.end,
      source: "apple" as const,
      sources: ["apple" as const],
    })),
  ];

  return dedupeCalendarEvents(unified);
}

export { getCalendarConnectionStatus } from "@/lib/calendar-connection";

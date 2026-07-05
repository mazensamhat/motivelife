import type { EnergyCurvePoint, WeeklyHeatMapDay } from "@forward/shared";
import { computeCalendarWorkload, type UnifiedCalendarEvent } from "@/lib/calendar-events";

const AWAKE_START_HOUR = 7;
const AWAKE_END_HOUR = 22;

const BASE_ENERGY: Record<number, number> = {
  7: 55,
  8: 72,
  9: 88,
  10: 92,
  11: 85,
  12: 68,
  13: 62,
  14: 58,
  15: 55,
  16: 60,
  17: 65,
  18: 58,
  19: 50,
  20: 42,
  21: 35,
  22: 28,
};

function formatHourLabel(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function hourBusy(events: UnifiedCalendarEvent[], hour: number, dayStart: Date): number {
  const slotStart = new Date(dayStart);
  slotStart.setHours(hour, 0, 0, 0);
  const slotEnd = new Date(dayStart);
  slotEnd.setHours(hour + 1, 0, 0, 0);

  let busyMs = 0;
  for (const event of events) {
    const start = Math.max(event.start.getTime(), slotStart.getTime());
    const end = Math.min(event.end.getTime(), slotEnd.getTime());
    if (end > start) busyMs += end - start;
  }
  return busyMs / 3600000;
}

export function computeEnergyCurve(
  events: UnifiedCalendarEvent[],
  dayOffset = 0
): EnergyCurvePoint[] {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() + dayOffset);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dayEvents = events.filter((e) => e.start >= dayStart && e.start < dayEnd);
  const points: EnergyCurvePoint[] = [];

  for (let hour = AWAKE_START_HOUR; hour <= AWAKE_END_HOUR; hour++) {
    const base = BASE_ENERGY[hour] ?? 50;
    const busy = hourBusy(dayEvents, hour, dayStart);
    const level = Math.round(Math.max(20, Math.min(98, base - busy * 28)));
    points.push({ hour, label: formatHourLabel(hour), level });
  }

  return points;
}

export function computeWeeklyHeatMap(events: UnifiedCalendarEvent[]): WeeklyHeatMapDay[] {
  const days: WeeklyHeatMapDay[] = [];

  for (let offset = 0; offset < 7; offset++) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + offset);

    const workload = computeCalendarWorkload(events, offset);
    const dayLabel = dayStart.toLocaleDateString(undefined, { weekday: "short" });

    days.push({
      dateIso: dayStart.toISOString(),
      dayLabel,
      percent: workload.percent,
      isToday: offset === 0,
      isTomorrow: offset === 1,
    });
  }

  return days;
}

import { createDAVClient } from "tsdav";
import ical, { type VEvent } from "node-ical";

const ICLOUD_CALDAV_URL = "https://caldav.icloud.com";

function isVEvent(item: ical.CalendarComponent | undefined): item is VEvent {
  return Boolean(item && item.type === "VEVENT");
}

export interface AppleCalendarEvent {
  title: string;
  start: Date;
  end: Date;
}

export async function fetchAppleCalendarEvents(
  appleId: string,
  appPassword: string,
  timeMin: Date,
  timeMax: Date
): Promise<AppleCalendarEvent[]> {
  const client = await createDAVClient({
    serverUrl: ICLOUD_CALDAV_URL,
    credentials: {
      username: appleId.trim(),
      password: appPassword.trim(),
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  const calendars = await client.fetchCalendars();
  if (!calendars.length) return [];

  const events: AppleCalendarEvent[] = [];
  const seen = new Set<string>();

  for (const calendar of calendars.slice(0, 8)) {
    let objects;
    try {
      objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: timeMin.toISOString(),
          end: timeMax.toISOString(),
        },
      });
    } catch {
      continue;
    }

    for (const obj of objects) {
      if (!obj.data) continue;
      let parsed: ReturnType<typeof ical.sync.parseICS>;
      try {
        parsed = ical.sync.parseICS(obj.data);
      } catch {
        continue;
      }

      for (const item of Object.values(parsed)) {
        if (!isVEvent(item)) continue;
        const summary = item.summary;
        if (!summary || typeof summary !== "string") continue;

        const startRaw = item.start;
        const endRaw = item.end ?? item.start;
        if (!startRaw) continue;

        const start = startRaw instanceof Date ? startRaw : new Date(String(startRaw));
        const end = endRaw instanceof Date ? endRaw : new Date(String(endRaw));
        if (Number.isNaN(start.getTime())) continue;

        const key = `${summary}-${start.toISOString()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        events.push({
          title: summary,
          start,
          end: Number.isNaN(end.getTime()) ? start : end,
        });
      }
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export { ICLOUD_CALDAV_URL };

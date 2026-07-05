import { createDAVClient } from "tsdav";
import ical, { type VEvent } from "node-ical";
import { prisma } from "@forward/database";

const ICLOUD_CALDAV_URL = "https://caldav.icloud.com";

function isVEvent(item: ical.CalendarComponent | undefined): item is VEvent {
  return Boolean(item && item.type === "VEVENT");
}

export interface AppleCalendarEvent {
  title: string;
  start: Date;
  end: Date;
}

export function isAppleCalDAVConnected(integration: { accessToken: string } | null): boolean {
  return Boolean(integration?.accessToken);
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

export async function getAppleCalendarEvents(userId: string, days = 1): Promise<AppleCalendarEvent[]> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "APPLE_CALDAV" } },
  });
  if (!integration?.accessToken || !integration.accountEmail) return [];

  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + days);

  return fetchAppleCalendarEvents(
    integration.accountEmail,
    integration.accessToken,
    timeMin,
    timeMax
  );
}

export async function saveAppleCalDAVConnection(
  userId: string,
  appleId: string,
  appPassword: string
): Promise<void> {
  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + 1);

  await fetchAppleCalendarEvents(appleId, appPassword, timeMin, timeMax);

  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId, provider: "APPLE_CALDAV" } },
    create: {
      userId,
      provider: "APPLE_CALDAV",
      accessToken: appPassword,
      accountEmail: appleId,
      accountLabel: appleId,
      scope: "caldav.readonly",
      metadata: JSON.stringify({ serverUrl: ICLOUD_CALDAV_URL }),
    },
    update: {
      accessToken: appPassword,
      accountEmail: appleId,
      accountLabel: appleId,
    },
  });
}

export async function disconnectAppleCalDAV(userId: string): Promise<void> {
  await prisma.userIntegration.deleteMany({
    where: { userId, provider: "APPLE_CALDAV" },
  });
}

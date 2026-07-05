import { prisma } from "@forward/database";
import type { AppleCalendarEvent } from "@/lib/apple-caldav-fetch";

export type { AppleCalendarEvent };

export function isAppleCalDAVConnected(integration: { accessToken: string } | null): boolean {
  return Boolean(integration?.accessToken);
}

async function fetchAppleCalendarEvents(
  appleId: string,
  appPassword: string,
  timeMin: Date,
  timeMax: Date
): Promise<AppleCalendarEvent[]> {
  const { fetchAppleCalendarEvents: fetchEvents } = await import("@/lib/apple-caldav-fetch");
  return fetchEvents(appleId, appPassword, timeMin, timeMax);
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

  const { ICLOUD_CALDAV_URL } = await import("@/lib/apple-caldav-fetch");

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

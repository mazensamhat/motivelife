import { prisma } from "@forward/database";
import type { CalendarConnectionStatus } from "@forward/shared";
import {
  isGoogleCalendarConnected,
  isGoogleCalendarWriteEnabled,
  isGoogleConfigured,
} from "@/lib/google-calendar";

function isAppleCalDAVConnected(integration: { accessToken: string } | null): boolean {
  return Boolean(integration?.accessToken);
}

export async function getCalendarConnectionStatus(
  userId: string
): Promise<CalendarConnectionStatus> {
  const [google, apple] = await Promise.all([
    prisma.userIntegration.findUnique({
      where: { userId_provider: { userId, provider: "GOOGLE" } },
    }),
    prisma.userIntegration.findUnique({
      where: { userId_provider: { userId, provider: "APPLE_CALDAV" } },
    }),
  ]);

  const googleConnected = Boolean(google && isGoogleCalendarConnected(google.scope));
  const appleConnected = Boolean(apple && isAppleCalDAVConnected(apple));

  return {
    google: {
      configured: isGoogleConfigured(),
      connected: googleConnected,
      writeEnabled: Boolean(google && isGoogleCalendarWriteEnabled(google.scope)),
      accountEmail: google?.accountEmail ?? null,
    },
    apple: {
      connected: appleConnected,
      accountEmail: apple?.accountEmail ?? null,
    },
    anyConnected: googleConnected || appleConnected,
  };
}

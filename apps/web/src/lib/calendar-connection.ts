import { prisma } from "@forward/database";
import type { CalendarConnectionStatus } from "@forward/shared";
import { isGoogleCalendarConnected, isGoogleConfigured } from "@/lib/google-calendar";
import { isAppleCalDAVConnected } from "@/lib/apple-caldav";

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
      accountEmail: google?.accountEmail ?? null,
    },
    apple: {
      connected: appleConnected,
      accountEmail: apple?.accountEmail ?? null,
    },
    anyConnected: googleConnected || appleConnected,
  };
}

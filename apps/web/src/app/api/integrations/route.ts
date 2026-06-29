import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { isGoogleCalendarConnected, isGoogleConfigured } from "@/lib/google-calendar";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const google = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId: session.id, provider: "GOOGLE" } },
  });

  return json({
    google: {
      configured: isGoogleConfigured(),
      connected: Boolean(google && isGoogleCalendarConnected(google.scope)),
      accountEmail: google?.accountEmail ?? null,
    },
  });
}

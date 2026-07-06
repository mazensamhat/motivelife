import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { getCalendarConnectionStatus } from "@/lib/calendar-connection";
import { getGoogleRedirectUri } from "@/lib/google-calendar";
import { getHealthIntegrationStatus } from "@/lib/health-connection";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const [status, health] = await Promise.all([
    getCalendarConnectionStatus(session.id),
    getHealthIntegrationStatus(session.id),
  ]);

  return json({
    ...status,
    google: {
      ...status.google,
      redirectUri: getGoogleRedirectUri(),
    },
    health,
  });
}

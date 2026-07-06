import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { getCalendarConnectionStatus } from "@/lib/calendar-connection";
import { getGoogleRedirectUri } from "@/lib/google-calendar";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const status = await getCalendarConnectionStatus(session.id);
  return json({
    ...status,
    google: {
      ...status.google,
      redirectUri: getGoogleRedirectUri(),
    },
  });
}

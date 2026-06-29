import { getSession } from "@/lib/session";
import { getGoogleCalendarEvents } from "@/lib/google-calendar";
import { json, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const events = await getGoogleCalendarEvents(session.id, 7);
  return json({
    events: events.map((e) => ({
      title: e.title,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
    })),
  });
}

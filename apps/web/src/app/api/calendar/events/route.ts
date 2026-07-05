import { getSession } from "@/lib/session";
import { getCalendarEvents } from "@/lib/calendar-events";
import { json, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const events = await getCalendarEvents(session.id, 7);
  return json({
    events: events.map((e) => ({
      title: e.title,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      source: e.source,
      sources: e.sources,
    })),
  });
}

import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";

const schema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid request.");

    if (parsed.data.all) {
      await markAllNotificationsRead(session.id);
      return json({ ok: true });
    }

    if (parsed.data.id) {
      await markNotificationRead(session.id, parsed.data.id);
      return json({ ok: true });
    }

    return badRequest("Missing notification id.");
  } catch (error) {
    console.error("[api/notifications/read]", error);
    return serverError("Could not update notifications.");
  }
}

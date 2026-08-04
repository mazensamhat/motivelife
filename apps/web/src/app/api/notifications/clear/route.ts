import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { clearNotifications, deleteNotification } from "@/lib/notifications";

const schema = z.object({
  id: z.string().optional(),
  scope: z.enum(["alerts", "all"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid request.");

    if (parsed.data.id) {
      await deleteNotification(session.id, parsed.data.id);
      return json({ ok: true, deleted: 1 });
    }

    const deleted = await clearNotifications(session.id, parsed.data.scope ?? "alerts");
    return json({ ok: true, deleted });
  } catch (error) {
    console.error("[api/notifications/clear]", error);
    return serverError("Could not clear notifications.");
  }
}

import { getSession } from "@/lib/session";
import { json, unauthorized, serverError } from "@/lib/api";
import { listNotifications } from "@/lib/notifications";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const data = await listNotifications(session.id);
    return json(data);
  } catch (error) {
    console.error("[api/notifications]", error);
    return serverError("Could not load notifications.");
  }
}

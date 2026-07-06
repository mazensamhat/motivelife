import { getSession } from "@/lib/session";
import { json, unauthorized, badRequest, serverError } from "@/lib/api";
import { syncFitbitHealth } from "@/lib/fitbit";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const result = await syncFitbitHealth(session.id);
    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return badRequest(message);
  }
}

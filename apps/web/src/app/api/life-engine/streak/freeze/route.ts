import { getSession } from "@/lib/session";
import { json, unauthorized, serverError, badRequest } from "@/lib/api";
import { useLifeEngineFreeze } from "@/lib/life-engine-streak";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const streak = await useLifeEngineFreeze(session.id);
    if (!streak) return badRequest("Streak freeze not available.");

    return json(streak);
  } catch (error) {
    console.error("[api/life-engine/streak/freeze]", error);
    return serverError("Could not use streak freeze.");
  }
}

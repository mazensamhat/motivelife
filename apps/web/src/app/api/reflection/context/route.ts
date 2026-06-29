import { getSession } from "@/lib/session";
import { json, unauthorized, serverError } from "@/lib/api";
import { getMorningReflectionContext } from "@/lib/voice-capture-processor";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const context = await getMorningReflectionContext(session.id);
    return json(context);
  } catch (error) {
    console.error("[api/reflection/context]", error);
    return serverError("Could not load reflection context.");
  }
}

import { getSession } from "@/lib/session";
import { json, unauthorized, serverError } from "@/lib/api";
import { computeRetirementGap } from "@/lib/retirement-gap";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const gap = await computeRetirementGap(session.id);
    return json({ gap });
  } catch (error) {
    console.error("[api/retirement-gap]", error);
    return serverError("Could not compute retirement gap.");
  }
}

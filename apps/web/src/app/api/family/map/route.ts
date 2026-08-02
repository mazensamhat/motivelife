import { getSession } from "@/lib/session";
import { json, serverError, unauthorized } from "@/lib/api";
import { getFamilyMapState } from "@/lib/family-map/map-state";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/map]", error);
    return serverError("Could not load Family Map.");
  }
}

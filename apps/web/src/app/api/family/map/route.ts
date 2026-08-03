import { getSession } from "@/lib/session";
import { json, serverError, unauthorized } from "@/lib/api";
import { databaseErrorMessage } from "@/lib/db-error";
import { getFamilyMapState } from "@/lib/family-map/map-state";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/map]", error);
    const mapped = databaseErrorMessage(error, "");
    if (mapped) return serverError(mapped);
    const raw = error instanceof Error ? error.message : String(error);
    // Short, actionable message — avoid dumping stack traces to the client.
    const safe =
      raw.length > 0 && raw.length < 180 && !/password|secret|DATABASE_URL=/i.test(raw)
        ? `Could not load Family Map: ${raw}`
        : "Could not load Family Map.";
    return serverError(safe);
  }
}

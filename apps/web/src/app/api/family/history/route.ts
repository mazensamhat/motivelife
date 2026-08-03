import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import {
  getMemberHistory,
  getTripRoutePath,
  type HistoryRange,
} from "@/lib/family-map/history";

const RANGES = new Set<HistoryRange>(["day", "month", "year", "all"]);

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId")?.trim();
    const tripId = url.searchParams.get("tripId")?.trim();
    const rangeRaw = (url.searchParams.get("range") ?? "day") as HistoryRange;
    const range = RANGES.has(rangeRaw) ? rangeRaw : "day";

    if (tripId) {
      try {
        const path = await getTripRoutePath({
          viewerUserId: session.id,
          tripId,
        });
        return json({ path });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return badRequest("Trip not found.");
        if (msg === "FORBIDDEN") return badRequest("Not allowed to view that drive.");
        if (msg === "NO_HOUSEHOLD") return badRequest("Join a family first.");
        throw e;
      }
    }

    if (!memberId) return badRequest("memberId is required.");

    try {
      const history = await getMemberHistory({
        viewerUserId: session.id,
        memberId,
        range,
      });
      return json(history);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return badRequest("Member not found.");
      if (msg === "NO_HOUSEHOLD") return badRequest("Join a family first.");
      throw e;
    }
  } catch (error) {
    console.error("[api/family/history]", error);
    return serverError("Could not load location history.");
  }
}

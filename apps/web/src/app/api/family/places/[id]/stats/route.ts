import { getSession } from "@/lib/session";
import { badRequest, json, premiumRequired, serverError, unauthorized } from "@/lib/api";
import { getPlaceIntelligence } from "@/lib/family-map/place-intel";
import type { HistoryRange } from "@/lib/family-map/history";
import { getViewerFamilyEntitlements } from "@/lib/family-map/require-intelligence";

const RANGES = new Set<HistoryRange>(["day", "month", "year", "all"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { entitlements } = await getViewerFamilyEntitlements();
    if (!entitlements?.intelligence) {
      return premiumRequired("Upgrade to KINZO AI for place visit intelligence.");
    }

    const { id } = await context.params;
    const placeId = id?.trim();
    if (!placeId) return badRequest("place id is required.");

    const url = new URL(request.url);
    const rangeRaw = (url.searchParams.get("range") ?? "month") as HistoryRange;
    const range = RANGES.has(rangeRaw) ? rangeRaw : "month";
    const tzRaw = url.searchParams.get("tzOffsetMinutes");
    const tzParsed = tzRaw != null && tzRaw.trim() !== "" ? Number(tzRaw) : null;
    const tzOffsetMinutes =
      tzParsed != null && Number.isFinite(tzParsed) && Math.abs(tzParsed) <= 16 * 60
        ? Math.trunc(tzParsed)
        : null;

    try {
      const stats = await getPlaceIntelligence({
        viewerUserId: session.id,
        placeId,
        range,
        tzOffsetMinutes,
      });
      return json({ stats });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return badRequest("Place not found.");
      if (msg === "NO_HOUSEHOLD") return badRequest("Join a family first.");
      throw e;
    }
  } catch (error) {
    console.error("[api/family/places/[id]/stats GET]", error);
    return serverError("Could not load place intelligence.");
  }
}

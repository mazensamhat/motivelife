import { getSession } from "@/lib/session";
import { badRequest, json, premiumRequired, serverError, unauthorized } from "@/lib/api";
import {
  clearHouseholdDriveHistory,
  clearMemberLocationHistory,
  getMemberHistory,
  getTripRoutePath,
  type HistoryRange,
} from "@/lib/family-map/history";
import { getViewerFamilyEntitlements } from "@/lib/family-map/require-intelligence";

const RANGES = new Set<HistoryRange>(["day", "month", "year", "all"]);

function parseOptionalFloat(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { entitlements } = await getViewerFamilyEntitlements();
    if (!entitlements?.intelligence) {
      return premiumRequired("Upgrade to KINZO AI for location history.");
    }

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId")?.trim();
    const tripId = url.searchParams.get("tripId")?.trim();
    const rangeRaw = (url.searchParams.get("range") ?? "day") as HistoryRange;
    const range = RANGES.has(rangeRaw) ? rangeRaw : "day";
    const tzRaw = url.searchParams.get("tzOffsetMinutes");
    const tzParsed = tzRaw != null && tzRaw.trim() !== "" ? Number(tzRaw) : null;
    const tzOffsetMinutes =
      tzParsed != null && Number.isFinite(tzParsed) && Math.abs(tzParsed) <= 16 * 60
        ? Math.trunc(tzParsed)
        : null;

    if (tripId) {
      try {
        const path = await getTripRoutePath({
          viewerUserId: session.id,
          tripId,
          memberId: url.searchParams.get("memberId"),
          startedAt: url.searchParams.get("startedAt"),
          endedAt: url.searchParams.get("endedAt"),
          startLat: parseOptionalFloat(url.searchParams.get("startLat")),
          startLng: parseOptionalFloat(url.searchParams.get("startLng")),
          endLat: parseOptionalFloat(url.searchParams.get("endLat")),
          endLng: parseOptionalFloat(url.searchParams.get("endLng")),
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
        tzOffsetMinutes,
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

/**
 * Clear cloud location history.
 * - memberId=… → your own trips/stays/events
 * - scope=household-drives → owner wipes household drive telematics (keeps stays)
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { entitlements } = await getViewerFamilyEntitlements();
    if (!entitlements?.intelligence) {
      return premiumRequired("Upgrade to KINZO AI for location history.");
    }

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope")?.trim();
    if (scope === "household-drives") {
      try {
        const cleared = await clearHouseholdDriveHistory({
          viewerUserId: session.id,
        });
        return json({ ok: true, scope, ...cleared });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "FORBIDDEN") {
          return badRequest("Only the household owner can reset family drive history.");
        }
        if (msg === "NO_HOUSEHOLD") return badRequest("Join a family first.");
        throw e;
      }
    }

    const memberId = url.searchParams.get("memberId")?.trim();
    if (!memberId) return badRequest("memberId is required.");

    try {
      const cleared = await clearMemberLocationHistory({
        viewerUserId: session.id,
        memberId,
      });
      return json({ ok: true, ...cleared });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return badRequest("Member not found.");
      if (msg === "FORBIDDEN") return badRequest("You can only clear your own history.");
      if (msg === "NO_HOUSEHOLD") return badRequest("Join a family first.");
      throw e;
    }
  } catch (error) {
    console.error("[api/family/history DELETE]", error);
    return serverError("Could not clear location history.");
  }
}

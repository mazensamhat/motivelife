import type { DriveTripSummary } from "@forward/shared";
import type { LocalHistoryPathPoint } from "@/lib/family-map/local-history-types";

function hasCoords(lat?: number | null, lng?: number | null) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

/** Load GPS breadcrumbs for a cloud / reconstructed drive. */
export async function fetchTripRoutePath(opts: {
  tripId: string;
  memberId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
}): Promise<LocalHistoryPathPoint[]> {
  const qs = new URLSearchParams({ tripId: opts.tripId });
  if (opts.memberId) qs.set("memberId", opts.memberId);
  if (opts.startedAt) qs.set("startedAt", opts.startedAt);
  if (opts.endedAt) qs.set("endedAt", opts.endedAt);
  if (opts.startLat != null && Number.isFinite(opts.startLat)) {
    qs.set("startLat", String(opts.startLat));
  }
  if (opts.startLng != null && Number.isFinite(opts.startLng)) {
    qs.set("startLng", String(opts.startLng));
  }
  if (opts.endLat != null && Number.isFinite(opts.endLat)) {
    qs.set("endLat", String(opts.endLat));
  }
  if (opts.endLng != null && Number.isFinite(opts.endLng)) {
    qs.set("endLng", String(opts.endLng));
  }
  const res = await fetch(`/api/family/history?${qs.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { path?: LocalHistoryPathPoint[] };
  return (data.path ?? []).filter((p) => hasCoords(p.lat, p.lng));
}

export async function fetchRouteForDriveTrip(
  trip: DriveTripSummary,
  fallbackMemberId?: string | null
): Promise<LocalHistoryPathPoint[]> {
  if (!trip.id) return [];
  return fetchTripRoutePath({
    tripId: trip.id,
    memberId: trip.memberId ?? fallbackMemberId,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    startLat: trip.startLat,
    startLng: trip.startLng,
    endLat: trip.endLat,
    endLng: trip.endLng,
  });
}

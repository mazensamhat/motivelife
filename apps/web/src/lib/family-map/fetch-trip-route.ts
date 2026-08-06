import type { DriveTripSummary } from "@forward/shared";
import type { LocalHistoryPathPoint } from "@/lib/family-map/local-history-types";
import {
  enrichPathWithRoadRoute,
} from "@/lib/family-map/road-route";

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
  let path: LocalHistoryPathPoint[] = [];
  if (res.ok) {
    const data = (await res.json()) as { path?: LocalHistoryPathPoint[] };
    path = (data.path ?? []).filter((p) => hasCoords(p.lat, p.lng));
  }

  // Prefer GPS from the API. Heal only true A→B leftovers; do not rewrite
  // multi-point trails into invented driving directions.
  if (path.length >= 2) {
    const routed = await enrichPathWithRoadRoute(path, {
      force: path.length <= 2,
    });
    if (routed.length >= 2) {
      path = routed.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        t: p.t ?? new Date().toISOString(),
        speedKmh: p.speedKmh ?? null,
      }));
    }
  }

  // Last resort: start/end only → still try a road route so history isn't a straight line.
  if (
    path.length < 2 &&
    hasCoords(opts.startLat, opts.startLng) &&
    hasCoords(opts.endLat, opts.endLng)
  ) {
    const routed = await enrichPathWithRoadRoute(
      [
        {
          lat: opts.startLat!,
          lng: opts.startLng!,
          t: opts.startedAt ?? new Date().toISOString(),
        },
        {
          lat: opts.endLat!,
          lng: opts.endLng!,
          t: opts.endedAt ?? new Date().toISOString(),
        },
      ],
      { force: true }
    );
    if (routed.length >= 2) {
      path = routed.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        t: p.t ?? new Date().toISOString(),
        speedKmh: p.speedKmh ?? null,
      }));
    }
  }

  return path;
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

/**
 * Life360-style location history: drives + place stays for a range,
 * with route breadcrumbs reconstructed from FamilyLocationEvent.
 * Also rebuilds missing drives/stays from GPS breadcrumbs (parents’ house, etc.).
 */

import { prisma } from "@forward/database";
import {
  driveScoreBand,
  haversineKm,
  sanitizeSpeedKmh,
  type DriveTripSummary,
  type FamilyHistoryItem,
  type FamilyPlaceVisitView,
} from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { getMemberForUser } from "./household";
import { reverseGeocodeLabel, shortCoordLabel } from "./reverse-geocode";
import { enrichPathWithRoadRoute } from "./road-route";

export type HistoryRange = "day" | "month" | "year" | "all";

function rangeStart(range: HistoryRange): Date | null {
  const now = new Date();
  if (range === "all") return null;
  const d = new Date(now);
  if (range === "day") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type HistoryRoutePoint = {
  lat: number;
  lng: number;
  t: string;
  speedKmh: number | null;
};

type EventRow = {
  lat: number;
  lng: number;
  speedKmh: number | null;
  recordedAt: Date;
};

/**
 * Cluster GPS breadcrumbs into stays (stationary areas) and drives between them.
 * Recovers history when trips/visits weren't written (unsaved stops like parents’ house).
 */
async function reconstructFromEvents(opts: {
  memberId: string;
  memberName: string;
  since: Date | null;
  existingTripEnds: Set<string>;
}): Promise<FamilyHistoryItem[]> {
  const events = await prisma.familyLocationEvent.findMany({
    where: {
      memberId: opts.memberId,
      ...(opts.since ? { recordedAt: { gte: opts.since } } : {}),
    },
    orderBy: { recordedAt: "asc" },
    take: 2000,
    select: { lat: true, lng: true, speedKmh: true, recordedAt: true },
  });
  if (events.length < 3) return [];

  const STAY_SPEED = 8;
  const STAY_RADIUS_M = 120;
  const MIN_STAY_MS = 3 * 60_000;
  const MIN_DRIVE_KM = 0.25;

  type Cluster =
    | {
        kind: "stay";
        points: EventRow[];
        start: Date;
        end: Date;
      }
    | {
        kind: "move";
        points: EventRow[];
        start: Date;
        end: Date;
      };

  const clusters: Cluster[] = [];
  let cur: Cluster | null = null;

  for (const e of events) {
    const speed = e.speedKmh ?? 0;
    const isStay = speed < STAY_SPEED;
    if (!cur) {
      cur = {
        kind: isStay ? "stay" : "move",
        points: [e],
        start: e.recordedAt,
        end: e.recordedAt,
      };
      continue;
    }

    const last = cur.points[cur.points.length - 1]!;
    const distM = haversineKm(last.lat, last.lng, e.lat, e.lng) * 1000;

    if (cur.kind === "stay") {
      if (isStay && distM <= STAY_RADIUS_M) {
        cur.points.push(e);
        cur.end = e.recordedAt;
      } else {
        clusters.push(cur);
        cur = {
          kind: isStay ? "stay" : "move",
          points: [e],
          start: e.recordedAt,
          end: e.recordedAt,
        };
      }
    } else {
      if (!isStay || distM > STAY_RADIUS_M) {
        cur.points.push(e);
        cur.end = e.recordedAt;
      } else {
        clusters.push(cur);
        cur = {
          kind: "stay",
          points: [e],
          start: e.recordedAt,
          end: e.recordedAt,
        };
      }
    }
  }
  if (cur) clusters.push(cur);

  const items: FamilyHistoryItem[] = [];
  const stays = clusters.filter(
    (c): c is Extract<Cluster, { kind: "stay" }> =>
      c.kind === "stay" && c.end.getTime() - c.start.getTime() >= MIN_STAY_MS
  );

  for (let i = 0; i < stays.length; i++) {
    const stay = stays[i]!;
    const mid = stay.points[Math.floor(stay.points.length / 2)]!;
    const dwellMinutes = Math.max(
      1,
      Math.round((stay.end.getTime() - stay.start.getTime()) / 60_000)
    );
    const bucket = `${mid.lat.toFixed(3)},${mid.lng.toFixed(3)}`;
    // Skip if we already have a DB visit near this time (handled by caller merge)
    let label = shortCoordLabel(mid.lat, mid.lng);
    try {
      const geo = await reverseGeocodeLabel(mid.lat, mid.lng);
      label = geo.label || label;
    } catch {
      // keep coord label
    }

    items.push({
      kind: "stay",
      id: `recon-stay-${opts.memberId}-${stay.start.getTime()}`,
      at: stay.end.toISOString(),
      visit: {
        id: `recon-stay-${opts.memberId}-${stay.start.getTime()}`,
        memberId: opts.memberId,
        placeName: label,
        arrivedAt: stay.start.toISOString(),
        departedAt: stay.end.toISOString(),
        dwellMinutes,
        isActive: false,
        placeLat: mid.lat,
        placeLng: mid.lng,
        placeRadiusM: 100,
      },
    });

    // Drive from previous stay → this stay
    if (i > 0) {
      const prev = stays[i - 1]!;
      const pathPoints = events.filter(
        (e) => e.recordedAt >= prev.end && e.recordedAt <= stay.start
      );
      let distanceKm = 0;
      for (let p = 1; p < pathPoints.length; p++) {
        distanceKm += haversineKm(
          pathPoints[p - 1]!.lat,
          pathPoints[p - 1]!.lng,
          pathPoints[p]!.lat,
          pathPoints[p]!.lng
        );
      }
      if (distanceKm < MIN_DRIVE_KM) continue;

      const durationMinutes = Math.max(
        1,
        Math.round((stay.start.getTime() - prev.end.getTime()) / 60_000)
      );
      const speeds = pathPoints
        .map((p) => p.speedKmh)
        .filter((s): s is number => s != null && s > 0);
      const maxSpeedKmh = speeds.length
        ? Math.round(Math.max(...speeds.map((s) => sanitizeSpeedKmh(s) ?? 0)))
        : 0;
      const avgSpeedKmh = speeds.length
        ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
        : 0;
      const endKey = stay.start.toISOString().slice(0, 16);
      if (opts.existingTripEnds.has(endKey)) continue;

      const prevMid = prev.points[Math.floor(prev.points.length / 2)]!;
      let fromLabel = shortCoordLabel(prevMid.lat, prevMid.lng);
      try {
        fromLabel = (await reverseGeocodeLabel(prevMid.lat, prevMid.lng)).label || fromLabel;
      } catch {
        // keep
      }

      const driveScore = driveScoreBand(
        Math.max(55, 95 - Math.max(0, maxSpeedKmh - 100))
      );
      // driveScoreBand returns band not score — compute a simple score
      const score = Math.max(55, Math.min(99, 94 - Math.max(0, maxSpeedKmh - 110)));

      items.push({
        kind: "drive",
        id: `recon-drive-${opts.memberId}-${prev.end.getTime()}`,
        at: stay.start.toISOString(),
        trip: {
          id: `recon-drive-${opts.memberId}-${prev.end.getTime()}`,
          memberId: opts.memberId,
          memberName: opts.memberName,
          fromLabel,
          toLabel: label,
          distanceKm: Number(distanceKm.toFixed(1)),
          durationMinutes,
          avgSpeedKmh,
          maxSpeedKmh,
          hardBraking: 0,
          rapidAcceleration: 0,
          unusualRouteEvents: 0,
          driveScore: score,
          band: driveScore,
          startedAt: prev.end.toISOString(),
          endedAt: stay.start.toISOString(),
          startLat: prevMid.lat,
          startLng: prevMid.lng,
          endLat: mid.lat,
          endLng: mid.lng,
        },
      });
    }
  }

  return items;
}

export async function getMemberHistory(opts: {
  viewerUserId: string;
  memberId: string;
  range: HistoryRange;
}): Promise<{
  memberId: string;
  memberName: string;
  isYou: boolean;
  items: FamilyHistoryItem[];
  visits: FamilyPlaceVisitView[];
  trips: DriveTripSummary[];
}> {
  await ensureFamilyMapSchema();
  const me = await getMemberForUser(opts.viewerUserId);
  if (!me) throw new Error("NO_HOUSEHOLD");

  const target = await prisma.familyMember.findFirst({
    where: { id: opts.memberId, householdId: me.householdId },
  });
  if (!target) throw new Error("NOT_FOUND");

  const isYou = target.id === me.id;
  const canSeeDriving =
    isYou ||
    (target.shareDrivingData &&
      target.locationSharingLevel !== "off" &&
      target.locationSharingLevel !== "eta_only" &&
      target.locationSharingLevel !== "destination_only");
  const canSeePlaces = isYou || target.sharePlaceHistory;

  const since = rangeStart(opts.range);

  const [tripsRaw, visitsRaw, places] = await Promise.all([
    canSeeDriving
      ? prisma.familyTrip.findMany({
          where: {
            memberId: target.id,
            OR: [
              { isActive: true },
              {
                isActive: false,
                endedAt: since ? { not: null, gte: since } : { not: null },
              },
            ],
          },
          orderBy: [{ isActive: "desc" }, { endedAt: "desc" }],
          take: 80,
        })
      : Promise.resolve([]),
    canSeePlaces
      ? prisma.familyPlaceVisit.findMany({
          where: {
            memberId: target.id,
            ...(since
              ? { OR: [{ arrivedAt: { gte: since } }, { isActive: true }] }
              : {}),
          },
          orderBy: { arrivedAt: "desc" },
          take: 80,
        })
      : Promise.resolve([]),
    prisma.familyPlace.findMany({
      where: { householdId: me.householdId },
      select: { id: true, name: true, lat: true, lng: true, radiusM: true },
    }),
  ]);

  const placeById = new Map(places.map((p) => [p.id, p]));
  const placeByName = new Map(places.map((p) => [p.name, p]));

  const trips: DriveTripSummary[] = tripsRaw.map((t) => ({
    id: t.id,
    memberId: t.memberId,
    memberName: target.displayName,
    fromLabel: t.fromLabel,
    toLabel: t.toLabel,
    distanceKm: Number(t.distanceKm.toFixed(1)),
    durationMinutes: Math.round(t.durationMinutes),
    avgSpeedKmh: Math.round(t.avgSpeedKmh),
    maxSpeedKmh: Math.round(sanitizeSpeedKmh(t.maxSpeedKmh) ?? 0),
    hardBraking: t.hardBraking,
    rapidAcceleration: t.rapidAcceleration,
    unusualRouteEvents: t.unusualRouteEvents,
    driveScore: t.driveScore,
    band: driveScoreBand(t.driveScore),
    personalBaselineScore: null,
    estimatedFuelCostCad: t.estimatedFuelCostCad ?? null,
    estimatedFuelLitres: t.estimatedFuelLitres ?? null,
    estimatedFuelKwh: t.estimatedFuelKwh ?? null,
    startedAt: t.startedAt.toISOString(),
    endedAt: t.endedAt?.toISOString() ?? null,
    startLat: t.startLat,
    startLng: t.startLng,
    endLat: t.endLat,
    endLng: t.endLng,
  }));

  const visits: FamilyPlaceVisitView[] = visitsRaw.map((v) => {
    const dwell = v.isActive
      ? Math.max(1, Math.round((Date.now() - v.arrivedAt.getTime()) / 60_000))
      : v.dwellMinutes;
    const place =
      (v.placeId ? placeById.get(v.placeId) : null) ?? placeByName.get(v.placeName) ?? null;
    return {
      id: v.id,
      memberId: v.memberId,
      placeId: v.placeId,
      placeName: v.placeName,
      arrivedAt: v.arrivedAt.toISOString(),
      departedAt: v.departedAt?.toISOString() ?? null,
      dwellMinutes: dwell,
      isActive: v.isActive,
      placeLat: v.lat ?? place?.lat ?? null,
      placeLng: v.lng ?? place?.lng ?? null,
      placeRadiusM: place?.radiusM ?? 100,
    } as FamilyPlaceVisitView & {
      placeLat: number | null;
      placeLng: number | null;
      placeRadiusM: number;
    };
  });

  const items: FamilyHistoryItem[] = [];
  const existingTripEnds = new Set(
    trips
      .map((t) => t.endedAt)
      .filter(Boolean)
      .map((iso) => iso!.slice(0, 16))
  );

  for (const trip of trips) {
    items.push({
      kind: "drive",
      id: trip.id!,
      at: trip.endedAt ?? trip.startedAt ?? new Date().toISOString(),
      trip,
    });
  }
  for (const visit of visits) {
    if (since && !visit.isActive && new Date(visit.arrivedAt) < since) continue;
    const enriched = visit as FamilyPlaceVisitView & {
      placeLat?: number | null;
      placeLng?: number | null;
      placeRadiusM?: number | null;
    };
    items.push({
      kind: "stay",
      id: visit.id,
      at: visit.isActive
        ? new Date().toISOString()
        : visit.departedAt ?? visit.arrivedAt,
      visit: enriched,
    });
  }

  // Recover missing parents-house style stops from GPS breadcrumbs
  if (canSeeDriving || canSeePlaces) {
    try {
      const reconstructed = await reconstructFromEvents({
        memberId: target.id,
        memberName: target.displayName,
        since,
        existingTripEnds,
      });
      for (const item of reconstructed) {
        if (item.kind === "drive") {
          // Skip near-duplicate of a DB trip (same end window)
          const endKey = (item.trip.endedAt ?? "").slice(0, 16);
          if (endKey && existingTripEnds.has(endKey)) continue;
          const dup = items.some(
            (i) =>
              i.kind === "drive" &&
              Math.abs(
                new Date(i.at).getTime() - new Date(item.at).getTime()
              ) < 10 * 60_000 &&
              Math.abs(i.trip.distanceKm - item.trip.distanceKm) < 0.8
          );
          if (dup) continue;
          items.push(item);
        } else {
          const v = item.visit;
          if (v.placeLat == null || v.placeLng == null) continue;
          const dup = items.some((i) => {
            if (i.kind !== "stay") return false;
            const lat = i.visit.placeLat;
            const lng = i.visit.placeLng;
            if (lat == null || lng == null) return false;
            return (
              haversineKm(lat, lng, v.placeLat!, v.placeLng!) * 1000 < 150 &&
              Math.abs(
                new Date(i.visit.arrivedAt).getTime() -
                  new Date(v.arrivedAt).getTime()
              ) < 20 * 60_000
            );
          });
          if (dup) continue;
          items.push(item);
        }
      }
    } catch {
      // reconstruction is best-effort
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    memberId: target.id,
    memberName: target.displayName,
    isYou,
    items: items.slice(0, 60),
    visits,
    trips,
  };
}

/** Rebuild A→B path from retained location breadcrumbs for a finished trip. */
export async function getTripRoutePath(opts: {
  viewerUserId: string;
  tripId: string;
  /** Required for reconstructed drives (recon-drive-*). */
  memberId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
}): Promise<HistoryRoutePoint[]> {
  await ensureFamilyMapSchema();
  const me = await getMemberForUser(opts.viewerUserId);
  if (!me) throw new Error("NO_HOUSEHOLD");

  // Synthetic reconstructed drives — load breadcrumbs between the stay windows.
  // Older code returned [] here, so the client drew a straight A→B line.
  if (opts.tripId.startsWith("recon-drive-")) {
    const parsed = parseReconDriveId(opts.tripId);
    const memberId = opts.memberId?.trim() || parsed?.memberId;
    if (!memberId) throw new Error("NOT_FOUND");

    const target = await prisma.familyMember.findFirst({
      where: { id: memberId, householdId: me.householdId },
      select: { id: true, userId: true, shareDrivingData: true },
    });
    if (!target) throw new Error("NOT_FOUND");
    const isYou = target.id === me.id;
    if (!isYou && !target.shareDrivingData) throw new Error("FORBIDDEN");

    const startedAt = parseIsoDate(opts.startedAt) ??
      (parsed ? new Date(parsed.startedMs) : null);
    const endedAt = parseIsoDate(opts.endedAt);
    if (!startedAt || !endedAt || !(endedAt.getTime() > startedAt.getTime())) {
      throw new Error("NOT_FOUND");
    }

    return loadBreadcrumbPath({
      memberId: target.id,
      startedAt,
      endedAt,
      startLat: opts.startLat ?? null,
      startLng: opts.startLng ?? null,
      endLat: opts.endLat ?? null,
      endLng: opts.endLng ?? null,
    });
  }

  const trip = await prisma.familyTrip.findFirst({
    where: {
      id: opts.tripId,
      member: { householdId: me.householdId },
    },
    include: { member: { select: { id: true, userId: true, shareDrivingData: true } } },
  });
  if (!trip || !trip.endedAt) throw new Error("NOT_FOUND");

  const isYou = trip.member.id === me.id;
  if (!isYou && !trip.member.shareDrivingData) throw new Error("FORBIDDEN");

  return loadBreadcrumbPath({
    memberId: trip.memberId,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    startLat: opts.startLat ?? trip.startLat,
    startLng: opts.startLng ?? trip.startLng,
    endLat: opts.endLat ?? trip.endLat,
    endLng: opts.endLng ?? trip.endLng,
  });
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** `recon-drive-<memberId>-<startedMs>` — memberId is a cuid (no trailing digits-only). */
function parseReconDriveId(
  tripId: string
): { memberId: string; startedMs: number } | null {
  const m = /^recon-drive-(.+)-(\d+)$/.exec(tripId);
  if (!m) return null;
  const memberId = m[1]!;
  const startedMs = Number(m[2]);
  if (!memberId || !Number.isFinite(startedMs)) return null;
  return { memberId, startedMs };
}

async function loadBreadcrumbPath(opts: {
  memberId: string;
  startedAt: Date;
  endedAt: Date;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
}): Promise<HistoryRoutePoint[]> {
  // Android foreground poll can be ~45s — pad so we don't miss the first/last sample.
  const padMs = 90_000;
  const events = await prisma.familyLocationEvent.findMany({
    where: {
      memberId: opts.memberId,
      recordedAt: {
        gte: new Date(opts.startedAt.getTime() - padMs),
        lte: new Date(opts.endedAt.getTime() + padMs),
      },
    },
    orderBy: { recordedAt: "asc" },
    take: 4000,
  });

  const points: HistoryRoutePoint[] = events
    .filter(
      (e) =>
        Number.isFinite(e.lat) &&
        Number.isFinite(e.lng) &&
        !(e.lat === 0 && e.lng === 0)
    )
    .map((e) => ({
      lat: e.lat,
      lng: e.lng,
      t: e.recordedAt.toISOString(),
      speedKmh: e.speedKmh,
    }));

  // Drop near-duplicate consecutive points so the polyline stays sharp.
  // Keep a slightly lower floor than before so sparse Android polls still draw curves.
  const deduped: HistoryRoutePoint[] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev) {
      deduped.push(p);
      continue;
    }
    const movedM = haversineKm(prev.lat, prev.lng, p.lat, p.lng) * 1000;
    if (movedM < 2.5) continue;
    deduped.push(p);
  }

  // Anchor start/end from the trip summary when breadcrumbs are sparse.
  const withEnds = ensurePathEndpoints(deduped, opts);
  if (withEnds.length < 2) return [];

  // Dense GPS crumbs still look like scribble on Homestead/Harvest — always
  // OSRM-snap history display polylines so phone and PC match on-road routes.
  const enriched = await enrichPathWithRoadRoute(withEnds, {
    minPointsForGpsOnly: 99,
    force: true,
  });
  const normalized: HistoryRoutePoint[] = enriched.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    t:
      p.t ??
      withEnds[Math.min(i, withEnds.length - 1)]?.t ??
      opts.startedAt.toISOString(),
    speedKmh: p.speedKmh ?? null,
  }));
  return downsamplePath(normalized, 800);
}

function ensurePathEndpoints(
  points: HistoryRoutePoint[],
  opts: {
    startedAt: Date;
    endedAt: Date;
    startLat: number | null;
    startLng: number | null;
    endLat: number | null;
    endLng: number | null;
  }
): HistoryRoutePoint[] {
  const out = points.slice();
  const startOk =
    opts.startLat != null &&
    opts.startLng != null &&
    Number.isFinite(opts.startLat) &&
    Number.isFinite(opts.startLng) &&
    !(opts.startLat === 0 && opts.startLng === 0);
  const endOk =
    opts.endLat != null &&
    opts.endLng != null &&
    Number.isFinite(opts.endLat) &&
    Number.isFinite(opts.endLng) &&
    !(opts.endLat === 0 && opts.endLng === 0);

  if (startOk) {
    const first = out[0];
    const startPt: HistoryRoutePoint = {
      lat: opts.startLat!,
      lng: opts.startLng!,
      t: opts.startedAt.toISOString(),
      speedKmh: null,
    };
    if (!first) out.unshift(startPt);
    else if (haversineKm(first.lat, first.lng, startPt.lat, startPt.lng) * 1000 > 40) {
      out.unshift(startPt);
    }
  }

  if (endOk) {
    const last = out[out.length - 1];
    const endPt: HistoryRoutePoint = {
      lat: opts.endLat!,
      lng: opts.endLng!,
      t: opts.endedAt.toISOString(),
      speedKmh: null,
    };
    if (!last) out.push(endPt);
    else if (haversineKm(last.lat, last.lng, endPt.lat, endPt.lng) * 1000 > 40) {
      out.push(endPt);
    }
  }

  return out;
}

/** Delete cloud location history for a household member (self or same household). */
export async function clearMemberLocationHistory(opts: {
  viewerUserId: string;
  memberId: string;
}): Promise<{ trips: number; visits: number; events: number }> {
  await ensureFamilyMapSchema();
  const me = await getMemberForUser(opts.viewerUserId);
  if (!me) throw new Error("NO_HOUSEHOLD");

  const target = await prisma.familyMember.findFirst({
    where: { id: opts.memberId, householdId: me.householdId },
    select: { id: true },
  });
  if (!target) throw new Error("NOT_FOUND");
  // Only clear your own history from the client for now.
  if (target.id !== me.id) throw new Error("FORBIDDEN");

  const [trips, visits, events] = await prisma.$transaction([
    prisma.familyTrip.deleteMany({ where: { memberId: target.id } }),
    prisma.familyPlaceVisit.deleteMany({ where: { memberId: target.id } }),
    prisma.familyLocationEvent.deleteMany({ where: { memberId: target.id } }),
  ]);

  await prisma.familyMember.update({
    where: { id: target.id },
    data: {
      currentPlaceId: null,
      currentPlaceEnteredAt: null,
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      statusLabel: "Stationary",
      presenceStatus: "stationary",
    },
  });

  return { trips: trips.count, visits: visits.count, events: events.count };
}

/** Keep endpoints + evenly spaced midpoints so Leaflet stays smooth. */
function downsamplePath(
  points: HistoryRoutePoint[],
  maxPoints: number
): HistoryRoutePoint[] {
  if (points.length <= maxPoints) return points;
  const out: HistoryRoutePoint[] = [points[0]!];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(points[Math.round(i * step)]!);
  }
  out.push(points[points.length - 1]!);
  return out;
}

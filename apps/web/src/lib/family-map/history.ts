/**
 * Life360-style location history: drives + place stays for a range,
 * with route breadcrumbs reconstructed from FamilyLocationEvent.
 */

import { prisma } from "@forward/database";
import {
  driveScoreBand,
  type DriveTripSummary,
  type FamilyHistoryItem,
  type FamilyPlaceVisitView,
} from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { getMemberForUser } from "./household";

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
            isActive: false,
            endedAt: { not: null },
            ...(since ? { endedAt: { gte: since } } : {}),
          },
          orderBy: { endedAt: "desc" },
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
    maxSpeedKmh: Math.round(t.maxSpeedKmh),
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
    return {
      id: v.id,
      memberId: v.memberId,
      placeId: v.placeId,
      placeName: v.placeName,
      arrivedAt: v.arrivedAt.toISOString(),
      departedAt: v.departedAt?.toISOString() ?? null,
      dwellMinutes: dwell,
      isActive: v.isActive,
    };
  });

  const items: FamilyHistoryItem[] = [];
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
    const place =
      (visit.placeId ? placeById.get(visit.placeId) : null) ??
      placeByName.get(visit.placeName) ??
      null;
    items.push({
      kind: "stay",
      id: visit.id,
      at: visit.isActive
        ? new Date().toISOString()
        : visit.departedAt ?? visit.arrivedAt,
      visit: {
        ...visit,
        placeLat: place?.lat ?? null,
        placeLng: place?.lng ?? null,
        placeRadiusM: place?.radiusM ?? null,
      },
    });
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
}): Promise<HistoryRoutePoint[]> {
  await ensureFamilyMapSchema();
  const me = await getMemberForUser(opts.viewerUserId);
  if (!me) throw new Error("NO_HOUSEHOLD");

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

  const events = await prisma.familyLocationEvent.findMany({
    where: {
      memberId: trip.memberId,
      recordedAt: {
        gte: trip.startedAt,
        lte: trip.endedAt,
      },
    },
    orderBy: { recordedAt: "asc" },
    take: 800,
  });

  if (events.length >= 2) {
    return events.map((e) => ({
      lat: e.lat,
      lng: e.lng,
      t: e.recordedAt.toISOString(),
      speedKmh: e.speedKmh,
    }));
  }

  // Fallback: start → end straight line
  if (trip.endLat != null && trip.endLng != null) {
    return [
      {
        lat: trip.startLat,
        lng: trip.startLng,
        t: trip.startedAt.toISOString(),
        speedKmh: null,
      },
      {
        lat: trip.endLat,
        lng: trip.endLng,
        t: trip.endedAt.toISOString(),
        speedKmh: null,
      },
    ];
  }

  return [];
}

import { prisma } from "@forward/database";
import {
  computeDriveScore,
  presenceFromSpeed,
  type FamilyPlaceCategory,
} from "@forward/shared";
import { haversineKm, speedKmhBetween } from "./geo";
import { learnPlaceLeave, learnPlaceVisit } from "./normal-life";
import { notifyHouseholdPlaceTransition } from "./place-alerts";
import {
  detectSuddenStopHazard,
  notifyHouseholdRoadHazard,
} from "./road-hazards";
import { estimateTripFuelCost, type FuelType } from "./vehicle-fuel";

const DRIVING_START_KMH = 18;
const DRIVING_END_KMH = 8;
const HARD_BRAKE_DELTA = 18;
const RAPID_ACCEL_DELTA = 16;
/** Keep breadcrumbs long enough for Month history maps (Life360-style). */
const EVENT_RETENTION_HOURS = 24 * 35;

type PlaceRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  category: string;
};

export async function findPlaceAt(
  householdId: string,
  lat: number,
  lng: number
): Promise<PlaceRow | null> {
  const places = await prisma.familyPlace.findMany({ where: { householdId } });
  let best: PlaceRow | null = null;
  let bestDist = Infinity;
  for (const p of places) {
    const distM = haversineKm(lat, lng, p.lat, p.lng) * 1000;
    if (distM <= p.radiusM && distM < bestDist) {
      best = p;
      bestDist = distM;
    }
  }
  return best;
}

async function predictDestination(opts: {
  memberId: string;
  householdId: string;
  fromPlaceName: string | null;
  lat: number;
  lng: number;
  headingDeg: number | null;
}): Promise<{ label: string; confidence: number; etaMinutes: number | null }> {
  const places = await prisma.familyPlace.findMany({ where: { householdId: opts.householdId } });
  const home = places.find((p) => p.category === "home") ?? places[0] ?? null;

  const recent = await prisma.familyTrip.findMany({
    where: { memberId: opts.memberId, isActive: false, endedAt: { not: null } },
    orderBy: { endedAt: "desc" },
    take: 40,
  });

  const hour = new Date().getHours();
  const scored = new Map<string, number>();
  for (const trip of recent) {
    if (opts.fromPlaceName && trip.fromLabel !== opts.fromPlaceName) continue;
    const tripHour = trip.startedAt.getHours();
    const hourBonus = Math.abs(tripHour - hour) <= 2 ? 2 : 0.5;
    scored.set(trip.toLabel, (scored.get(trip.toLabel) ?? 0) + hourBonus);
  }

  let bestLabel = home?.name ?? "Home";
  let bestScore = 0;
  for (const [label, score] of scored) {
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }

  const target = places.find((p) => p.name === bestLabel) ?? home;
  let etaMinutes: number | null = null;
  if (target) {
    const dist = haversineKm(opts.lat, opts.lng, target.lat, target.lng);
    const speed = 42; // urban blend
    etaMinutes = Math.max(1, Math.round((dist / speed) * 60));
  }

  const confidence =
    bestScore >= 4 ? 0.89 : bestScore >= 2 ? 0.72 : home ? 0.55 : 0.35;

  // Slight heading bias toward target
  if (target && opts.headingDeg != null) {
    // keep confidence; destination still home-biased for MVP
  }

  return { label: bestLabel, confidence, etaMinutes };
}

function statusLabelFor(opts: {
  presence: string;
  placeName: string | null;
  destination: string | null;
  etaMinutes: number | null;
}): string {
  if (opts.presence === "driving" || opts.presence === "moving") {
    if (opts.destination && opts.etaMinutes != null) {
      return `→ ${opts.destination} · ETA ${opts.etaMinutes} min`;
    }
    return opts.presence === "driving" ? "Driving" : "Moving";
  }
  if (opts.placeName) {
    return `At ${opts.placeName}`;
  }
  return "Stationary";
}

export async function ingestLocationPing(opts: {
  memberId: string;
  householdId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  speedKmh?: number | null;
  headingDeg?: number | null;
  batteryPercent?: number | null;
  recordedAt?: Date;
}) {
  const recordedAt = opts.recordedAt ?? new Date();
  const member = await prisma.familyMember.findUniqueOrThrow({
    where: { id: opts.memberId },
  });

  let speed = opts.speedKmh ?? null;
  if (
    speed == null &&
    member.lastLat != null &&
    member.lastLng != null &&
    member.lastLocationAt
  ) {
    speed = speedKmhBetween(
      member.lastLat,
      member.lastLng,
      member.lastLocationAt,
      opts.lat,
      opts.lng,
      recordedAt
    );
  }

  const presence = presenceFromSpeed(speed);
  const place = await findPlaceAt(opts.householdId, opts.lat, opts.lng);
  const placeChanged = (place?.id ?? null) !== (member.currentPlaceId ?? null);
  let nextPlaceEnteredAt: Date | null | undefined = undefined;

  if (placeChanged) {
    // Close previous stay
    if (member.currentPlaceId) {
      const prev = await prisma.familyPlace.findUnique({
        where: { id: member.currentPlaceId },
      });
      const enteredAt = member.currentPlaceEnteredAt;
      const dwellMinutes = enteredAt
        ? Math.max(1, Math.round((recordedAt.getTime() - enteredAt.getTime()) / 60_000))
        : 1;

      if (prev) {
        await prisma.familyPlace.update({
          where: { id: prev.id },
          data: { totalDwellMin: { increment: dwellMinutes } },
        });
        if (member.shareRoutineLearning) {
          await learnPlaceLeave({
            memberId: opts.memberId,
            placeName: prev.name,
            at: recordedAt,
          });
          await learnPlaceVisit({
            memberId: opts.memberId,
            placeName: prev.name,
            at: enteredAt ?? recordedAt,
            dwellMinutes,
          });
        }
        void notifyHouseholdPlaceTransition({
          householdId: opts.householdId,
          actorMemberId: opts.memberId,
          actorDisplayName: member.displayName,
          placeName: prev.name,
          kind: "departed",
          dwellMinutes,
        }).catch(() => undefined);
      }

      await prisma.familyPlaceVisit.updateMany({
        where: { memberId: opts.memberId, isActive: true },
        data: {
          departedAt: recordedAt,
          dwellMinutes,
          isActive: false,
        },
      });
    }

    // Open new stay
    if (place) {
      await prisma.familyPlace.update({
        where: { id: place.id },
        data: {
          visitCount: { increment: 1 },
          lastVisitedAt: recordedAt,
          mostCommonVisitorId: opts.memberId,
        },
      });
      await prisma.familyPlaceVisit.create({
        data: {
          memberId: opts.memberId,
          placeId: place.id,
          placeName: place.name,
          arrivedAt: recordedAt,
          isActive: true,
          dwellMinutes: 0,
        },
      });
      nextPlaceEnteredAt = recordedAt;
      void notifyHouseholdPlaceTransition({
        householdId: opts.householdId,
        actorMemberId: opts.memberId,
        actorDisplayName: member.displayName,
        placeName: place.name,
        kind: "arrived",
      }).catch(() => undefined);
    } else {
      nextPlaceEnteredAt = null;
    }
  }

  // Trip lifecycle
  const activeTrip = await prisma.familyTrip.findFirst({
    where: { memberId: opts.memberId, isActive: true },
    orderBy: { startedAt: "desc" },
  });

  const prevSpeed = member.lastSpeedKmh ?? 0;
  const nextSpeed = speed ?? 0;

  if (!activeTrip && nextSpeed >= DRIVING_START_KMH) {
    const fromLabel = place?.name ?? "Current location";
    await prisma.familyTrip.create({
      data: {
        memberId: opts.memberId,
        fromLabel,
        toLabel: "In progress",
        startLat: opts.lat,
        startLng: opts.lng,
        distanceKm: 0,
        maxSpeedKmh: nextSpeed,
        speedSum: nextSpeed,
        sampleCount: 1,
        startedAt: recordedAt,
        isActive: true,
      },
    });
  } else if (activeTrip) {
    const lastLat = member.lastLat ?? activeTrip.startLat;
    const lastLng = member.lastLng ?? activeTrip.startLng;
    const segment = haversineKm(lastLat, lastLng, opts.lat, opts.lng);
    const distanceKm = activeTrip.distanceKm + segment;
    const durationMinutes = Math.max(
      0.1,
      (recordedAt.getTime() - activeTrip.startedAt.getTime()) / 60_000
    );
    let hardBraking = activeTrip.hardBraking;
    let rapidAcceleration = activeTrip.rapidAcceleration;
    let unusualRouteEvents = activeTrip.unusualRouteEvents;
    if (prevSpeed - nextSpeed >= HARD_BRAKE_DELTA) hardBraking += 1;
    if (nextSpeed - prevSpeed >= RAPID_ACCEL_DELTA) rapidAcceleration += 1;

    const hazard = detectSuddenStopHazard({
      displayName: member.displayName,
      prevSpeedKmh: prevSpeed,
      nextSpeedKmh: nextSpeed,
      hardBrakingThisTrip: hardBraking,
    });
    if (hazard) {
      unusualRouteEvents += 1;
      void notifyHouseholdRoadHazard({
        householdId: opts.householdId,
        actorMemberId: opts.memberId,
        actorDisplayName: member.displayName,
        signal: hazard,
      }).catch(() => undefined);
    }

    const sampleCount = activeTrip.sampleCount + 1;
    const speedSum = activeTrip.speedSum + nextSpeed;
    const maxSpeedKmh = Math.max(activeTrip.maxSpeedKmh, nextSpeed);
    const avgSpeedKmh = speedSum / sampleCount;
    const driveScore = computeDriveScore({
      hardBraking,
      rapidAcceleration,
      unusualRouteEvents,
      maxSpeedKmh,
    });

    const shouldEnd =
      nextSpeed < DRIVING_END_KMH &&
      durationMinutes >= 2 &&
      (place != null || durationMinutes >= 8);

    if (shouldEnd) {
      const prediction = await predictDestination({
        memberId: opts.memberId,
        householdId: opts.householdId,
        fromPlaceName: activeTrip.fromLabel,
        lat: opts.lat,
        lng: opts.lng,
        headingDeg: opts.headingDeg ?? null,
      });
      const fuel = member.fuelType
        ? estimateTripFuelCost({
            distanceKm,
            fuelType: member.fuelType as FuelType,
            litresPer100km: member.litresPer100km,
            kwhPer100km: member.kwhPer100km,
            fuelPriceCadPerLitre: member.fuelPriceCadPerLitre ?? 1.55,
            evPriceCadPerKwh: member.evPriceCadPerKwh ?? 0.14,
          })
        : { litres: null, kwh: null, costCad: null };

      await prisma.familyTrip.update({
        where: { id: activeTrip.id },
        data: {
          toLabel: place?.name ?? prediction.label,
          endLat: opts.lat,
          endLng: opts.lng,
          distanceKm,
          durationMinutes,
          avgSpeedKmh,
          maxSpeedKmh,
          hardBraking,
          rapidAcceleration,
          unusualRouteEvents,
          driveScore,
          sampleCount,
          speedSum,
          estimatedFuelLitres: fuel.litres,
          estimatedFuelKwh: fuel.kwh,
          estimatedFuelCostCad: fuel.costCad,
          endedAt: recordedAt,
          isActive: false,
        },
      });
    } else {
      await prisma.familyTrip.update({
        where: { id: activeTrip.id },
        data: {
          distanceKm,
          durationMinutes,
          avgSpeedKmh,
          maxSpeedKmh,
          hardBraking,
          rapidAcceleration,
          unusualRouteEvents,
          driveScore,
          sampleCount,
          speedSum,
        },
      });
    }
  }

  const prediction = await predictDestination({
    memberId: opts.memberId,
    householdId: opts.householdId,
    fromPlaceName: place?.name ?? null,
    lat: opts.lat,
    lng: opts.lng,
    headingDeg: opts.headingDeg ?? null,
  });

  const statusLabel = statusLabelFor({
    presence,
    placeName: place?.name ?? null,
    destination: prediction.label,
    etaMinutes: prediction.etaMinutes,
  });

  await prisma.familyLocationEvent.create({
    data: {
      memberId: opts.memberId,
      lat: opts.lat,
      lng: opts.lng,
      speedKmh: speed,
      headingDeg: opts.headingDeg ?? null,
      recordedAt,
    },
  });

  // prune old events
  const cutoff = new Date(Date.now() - EVENT_RETENTION_HOURS * 3600_000);
  await prisma.familyLocationEvent.deleteMany({
    where: { memberId: opts.memberId, recordedAt: { lt: cutoff } },
  });

  const updated = await prisma.familyMember.update({
    where: { id: opts.memberId },
    data: {
      lastLat: opts.lat,
      lastLng: opts.lng,
      lastAccuracyM: opts.accuracyM ?? null,
      lastSpeedKmh: speed,
      lastHeadingDeg: opts.headingDeg ?? null,
      lastBatteryPercent: opts.batteryPercent ?? null,
      lastLocationAt: recordedAt,
      presenceStatus: presence,
      statusLabel,
      currentPlaceId: place?.id ?? null,
      ...(nextPlaceEnteredAt !== undefined
        ? { currentPlaceEnteredAt: nextPlaceEnteredAt }
        : place && !member.currentPlaceEnteredAt
          ? { currentPlaceEnteredAt: recordedAt }
          : {}),
      likelyDestination:
        presence === "driving" || presence === "moving" ? prediction.label : place?.name ?? null,
      destinationConfidence: prediction.confidence,
      etaMinutes:
        presence === "driving" || presence === "moving" ? prediction.etaMinutes : null,
    },
  });

  return updated;
}

export async function upsertPlace(opts: {
  householdId: string;
  name: string;
  lat: number;
  lng: number;
  radiusM?: number;
  category?: FamilyPlaceCategory;
}) {
  return prisma.familyPlace.upsert({
    where: {
      householdId_name: { householdId: opts.householdId, name: opts.name },
    },
    create: {
      householdId: opts.householdId,
      name: opts.name,
      lat: opts.lat,
      lng: opts.lng,
      radiusM: opts.radiusM ?? 120,
      category: opts.category ?? "other",
    },
    update: {
      lat: opts.lat,
      lng: opts.lng,
      radiusM: opts.radiusM ?? 120,
      category: opts.category ?? "other",
    },
  });
}

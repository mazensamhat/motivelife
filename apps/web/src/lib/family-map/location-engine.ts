import { prisma } from "@forward/database";
import {
  computeDriveScore,
  presenceFromSpeed,
  type FamilyPlaceCategory,
} from "@forward/shared";
import { haversineKm, speedKmhBetween } from "./geo";
import {
  asGeofenceShape,
  geofenceMatchDistanceM,
  isInsideGeofence,
} from "./geofence";
import { learnPlaceLeave, learnPlaceVisit } from "./normal-life";
import { notifyHouseholdPlaceTransition, notifyIfStillInsideGeofence } from "./place-alerts";
import { applyLifeImpactFromTrip } from "./life-impact";
import { reverseGeocodeLabel, shortCoordLabel } from "./reverse-geocode";
import {
  detectSuddenStopHazard,
  notifyHouseholdRoadHazard,
} from "./road-hazards";
import { estimateTripFuelCost, type FuelType } from "./vehicle-fuel";

const DRIVING_START_KMH = 14;
const DRIVING_END_KMH = 8;
const HARD_BRAKE_DELTA = 18;
const RAPID_ACCEL_DELTA = 16;
/** Keep breadcrumbs long enough for Month history maps (Life360-style). */
const EVENT_RETENTION_HOURS = 24 * 35;
/** Open an unsaved stop after this many minutes stationary away from a saved place */
const UNSAVED_STOP_MINUTES = 4;

type PlaceRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  category: string;
  shape?: string | null;
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
    const shape = asGeofenceShape(p.shape);
    if (
      !isInsideGeofence({
        shape,
        placeLat: p.lat,
        placeLng: p.lng,
        radiusM: p.radiusM,
        lat,
        lng,
      })
    ) {
      continue;
    }
    const distM = geofenceMatchDistanceM({
      shape,
      placeLat: p.lat,
      placeLng: p.lng,
      lat,
      lng,
    });
    if (distM < bestDist) {
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
}): Promise<{ label: string | null; confidence: number; etaMinutes: number | null }> {
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

  let bestLabel: string | null = null;
  let bestScore = 0;
  for (const [label, score] of scored) {
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }

  // Don't invent "Home" as destination on thin evidence — that made Family Flow
  // claim everyone was heading/home while someone was just driving.
  if (!bestLabel || bestScore < 1.5) {
    return { label: null, confidence: 0.2, etaMinutes: null };
  }

  const target = places.find((p) => p.name === bestLabel) ?? null;
  let etaMinutes: number | null = null;
  if (target) {
    const dist = haversineKm(opts.lat, opts.lng, target.lat, target.lng);
    const speed = 42; // urban blend
    etaMinutes = Math.max(1, Math.round((dist / speed) * 60));
  }

  const confidence =
    bestScore >= 4 ? 0.89 : bestScore >= 2 ? 0.72 : 0.55;

  return { label: bestLabel, confidence, etaMinutes };
}

function statusLabelFor(opts: {
  presence: string;
  placeName: string | null;
  destination: string | null;
  etaMinutes: number | null;
}): string {
  if (opts.presence === "driving") {
    if (opts.destination && opts.etaMinutes != null) {
      return `Driving to ${opts.destination} · ETA ${opts.etaMinutes} min`;
    }
    return "Driving";
  }
  if (opts.presence === "moving") {
    // Life360-style: foot-speed movement reads as walking, with place context when known.
    if (opts.placeName) return `Walking near ${opts.placeName}`;
    return "Walking";
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

  // Drop clearly older GPS stamps so a cached home fix can't overwrite a newer live fix.
  if (
    opts.recordedAt &&
    member.lastLocationAt &&
    opts.recordedAt.getTime() < member.lastLocationAt.getTime() - 3_000
  ) {
    return member;
  }

  // Very inaccurate stationary samples often keep people glued inside a home geofence.
  const accuracy = opts.accuracyM ?? null;
  const inaccurate =
    accuracy != null && accuracy > 120 && (opts.speedKmh == null || opts.speedKmh < 3);
  if (
    inaccurate &&
    member.lastLat != null &&
    member.lastLng != null &&
    haversineKm(member.lastLat, member.lastLng, opts.lat, opts.lng) * 1000 < 40
  ) {
    // Ignore near-duplicate fuzzy reads — they fake "fresh" home presence.
    return member;
  }

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
  // While clearly in motion, don't stay attached to a geofence — that made
  // Family Flow say "everyone is home" while someone was driving through Home.
  const placeRaw = await findPlaceAt(opts.householdId, opts.lat, opts.lng);
  const place =
    presence === "driving" || (presence === "moving" && (speed ?? 0) >= 8)
      ? null
      : placeRaw;
  const placeChanged = (place?.id ?? null) !== (member.currentPlaceId ?? null);
  let nextPlaceEnteredAt: Date | null | undefined = undefined;

  async function closeActiveVisit(departedAt: Date, endLat: number, endLng: number) {
    const active = await prisma.familyPlaceVisit.findFirst({
      where: { memberId: opts.memberId, isActive: true },
      orderBy: { arrivedAt: "desc" },
    });
    if (!active) return null;
    const dwellMinutes = Math.max(
      1,
      Math.round((departedAt.getTime() - active.arrivedAt.getTime()) / 60_000)
    );
    await prisma.familyPlaceVisit.update({
      where: { id: active.id },
      data: {
        departedAt,
        dwellMinutes,
        isActive: false,
        lat: active.lat ?? endLat,
        lng: active.lng ?? endLng,
      },
    });
    return { ...active, dwellMinutes };
  }

  if (placeChanged) {
    // Close previous stay (saved place or unsaved stop)
    if (member.currentPlaceId || member.currentPlaceEnteredAt) {
      const closed = await closeActiveVisit(recordedAt, opts.lat, opts.lng);
      if (member.currentPlaceId) {
        const prev = await prisma.familyPlace.findUnique({
          where: { id: member.currentPlaceId },
        });
        const dwellMinutes =
          closed?.dwellMinutes ??
          (member.currentPlaceEnteredAt
            ? Math.max(
                1,
                Math.round(
                  (recordedAt.getTime() - member.currentPlaceEnteredAt.getTime()) / 60_000
                )
              )
            : 1);
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
              at: member.currentPlaceEnteredAt ?? recordedAt,
              dwellMinutes,
            });
          }
          void notifyHouseholdPlaceTransition({
            householdId: opts.householdId,
            actorMemberId: opts.memberId,
            actorDisplayName: member.displayName,
            placeName: prev.name,
            placeId: prev.id,
            kind: "departed",
            dwellMinutes,
          }).catch(() => undefined);
        }
      }
    }

    // Open new stay at a saved place
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
          lat: place.lat,
          lng: place.lng,
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
        placeId: place.id,
        kind: "arrived",
      }).catch(() => undefined);
    } else {
      nextPlaceEnteredAt = null;
    }
  } else if (
    !place &&
    presence === "stationary" &&
    !(await prisma.familyPlaceVisit.findFirst({
      where: { memberId: opts.memberId, isActive: true },
      select: { id: true },
    }))
  ) {
    // Life360: record unsaved stops (parents’ house, etc.) after dwelling
    const enteredHint = member.currentPlaceEnteredAt ?? member.lastLocationAt;
    const dwellMin = enteredHint
      ? (recordedAt.getTime() - enteredHint.getTime()) / 60_000
      : 0;
    const nearLast =
      member.lastLat != null &&
      member.lastLng != null &&
      haversineKm(member.lastLat, member.lastLng, opts.lat, opts.lng) * 1000 < 90;
    if (dwellMin >= UNSAVED_STOP_MINUTES && nearLast) {
      const geo = await reverseGeocodeLabel(opts.lat, opts.lng);
      await prisma.familyPlaceVisit.create({
        data: {
          memberId: opts.memberId,
          placeId: null,
          placeName: geo.label || shortCoordLabel(opts.lat, opts.lng),
          lat: opts.lat,
          lng: opts.lng,
          arrivedAt: enteredHint ?? recordedAt,
          isActive: true,
          dwellMinutes: Math.round(dwellMin),
        },
      });
      nextPlaceEnteredAt = enteredHint ?? recordedAt;
    } else if (!member.currentPlaceEnteredAt && presence === "stationary") {
      nextPlaceEnteredAt = recordedAt;
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
    // Leaving a stop to drive — close any open stay
    await closeActiveVisit(recordedAt, opts.lat, opts.lng);
    const fromLabel = place?.name ?? (await reverseGeocodeLabel(opts.lat, opts.lng)).label;
    await prisma.familyTrip.create({
      data: {
        memberId: opts.memberId,
        fromLabel: fromLabel || "Current location",
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
    nextPlaceEnteredAt = null;
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
      durationMinutes >= 1.5 &&
      (place != null ||
        durationMinutes >= 4 ||
        (presence === "stationary" && distanceKm >= 0.2));

    if (shouldEnd) {
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

      // Real arrival label — never invent "Home" from destination prediction
      let toLabel = place?.name ?? null;
      if (!toLabel) {
        const geo = await reverseGeocodeLabel(opts.lat, opts.lng);
        toLabel = geo.label || shortCoordLabel(opts.lat, opts.lng);
      }

      await prisma.familyTrip.update({
        where: { id: activeTrip.id },
        data: {
          toLabel,
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

      void applyLifeImpactFromTrip({
        memberId: opts.memberId,
        userId: member.userId,
        displayName: member.displayName,
        shareDigitalTwinIntegration: member.shareDigitalTwinIntegration !== false,
        shareDrivingData: member.shareDrivingData,
        toLabel,
        distanceKm,
        durationMinutes,
        driveScore,
        estimatedFuelCostCad: fuel.costCad,
        endedAt: recordedAt,
      }).catch(() => undefined);

      // Always open a stay at the destination so "parents house" shows in history
      const alreadyThere = await prisma.familyPlaceVisit.findFirst({
        where: { memberId: opts.memberId, isActive: true },
        select: { id: true },
      });
      if (!alreadyThere) {
        await prisma.familyPlaceVisit.create({
          data: {
            memberId: opts.memberId,
            placeId: place?.id ?? null,
            placeName: toLabel,
            lat: place?.lat ?? opts.lat,
            lng: place?.lng ?? opts.lng,
            arrivedAt: recordedAt,
            isActive: true,
            dwellMinutes: 0,
          },
        });
        nextPlaceEnteredAt = recordedAt;
        if (place) {
          void notifyHouseholdPlaceTransition({
            householdId: opts.householdId,
            actorMemberId: opts.memberId,
            actorDisplayName: member.displayName,
            placeName: place.name,
            placeId: place.id,
            kind: "arrived",
          }).catch(() => undefined);
        }
      }
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

  // Geofence “hasn’t left yet” when still dwelling past usual leave
  if (place && presence === "stationary") {
    void notifyIfStillInsideGeofence({
      householdId: opts.householdId,
      actorMemberId: opts.memberId,
      actorDisplayName: member.displayName,
      placeId: place.id,
      placeName: place.name,
    }).catch(() => undefined);
  }

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
  shape?: "circle" | "square";
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
      shape: opts.shape ?? "circle",
    },
    update: {
      lat: opts.lat,
      lng: opts.lng,
      radiusM: opts.radiusM ?? 120,
      category: opts.category ?? "other",
      ...(opts.shape ? { shape: opts.shape } : {}),
    },
  });
}

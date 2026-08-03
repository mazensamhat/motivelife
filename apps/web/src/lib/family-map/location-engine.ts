import { prisma } from "@forward/database";
import {
  computeDriveScore,
  presenceFromSpeed,
  sanitizeSpeedKmh,
  type FamilyPlaceCategory,
} from "@forward/shared";
import { haversineKm, speedKmhBetween, bearingDeg } from "./geo";
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

function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Destination Prediction — blend heading alignment, approach, proximity,
 * and habitual trip patterns into a continuous confidence (not fixed 55%).
 */
async function predictDestination(opts: {
  memberId: string;
  householdId: string;
  fromPlaceName: string | null;
  lat: number;
  lng: number;
  headingDeg: number | null;
  prevLat?: number | null;
  prevLng?: number | null;
  speedKmh?: number | null;
}): Promise<{ label: string | null; confidence: number; etaMinutes: number | null }> {
  const places = await prisma.familyPlace.findMany({
    where: { householdId: opts.householdId },
  });
  if (places.length === 0) {
    return { label: null, confidence: 0, etaMinutes: null };
  }

  const recent = await prisma.familyTrip.findMany({
    where: { memberId: opts.memberId, isActive: false, endedAt: { not: null } },
    orderBy: { endedAt: "desc" },
    take: 50,
  });

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Habit scores by destination label
  const habit = new Map<string, number>();
  for (const trip of recent) {
    if (opts.fromPlaceName && trip.fromLabel !== opts.fromPlaceName) continue;
    const tripHour = trip.startedAt.getHours();
    const tripDay = trip.startedAt.getDay();
    const hourBonus = Math.abs(tripHour - hour) <= 2 ? 2.2 : Math.abs(tripHour - hour) <= 4 ? 1 : 0.35;
    const dayBonus = tripDay === day ? 1.2 : 0.4;
    habit.set(trip.toLabel, (habit.get(trip.toLabel) ?? 0) + hourBonus + dayBonus);
  }

  const speed = opts.speedKmh ?? null;
  const movingFast = speed != null && speed >= 14;

  type Cand = { name: string; score: number; distKm: number; etaMinutes: number | null };
  const cands: Cand[] = [];

  for (const place of places) {
    // Don't predict the place we're already inside.
    if (opts.fromPlaceName && place.name === opts.fromPlaceName) continue;

    const distKm = haversineKm(opts.lat, opts.lng, place.lat, place.lng);
    if (distKm < 0.05) continue; // already on top of it
    if (distKm > 80) continue; // too far for local destination intel

    let score = 0;

    // Habit / time-of-day
    const h = habit.get(place.name) ?? 0;
    score += Math.min(4.5, h);

    // Heading alignment toward the place
    const toBearing = bearingDeg(opts.lat, opts.lng, place.lat, place.lng);
    if (opts.headingDeg != null && Number.isFinite(opts.headingDeg)) {
      const diff = angleDiffDeg(opts.headingDeg, toBearing);
      if (diff <= 25) score += 4.2;
      else if (diff <= 45) score += 2.8;
      else if (diff <= 70) score += 1.2;
      else if (diff >= 120) score -= 2.5; // clearly heading away
    }

    // Getting closer vs last fix
    if (
      opts.prevLat != null &&
      opts.prevLng != null &&
      Number.isFinite(opts.prevLat) &&
      Number.isFinite(opts.prevLng)
    ) {
      const prevDist = haversineKm(opts.prevLat, opts.prevLng, place.lat, place.lng);
      const closing = prevDist - distKm;
      if (closing > 0.04) score += Math.min(3.5, closing * 12); // closing fast
      else if (closing < -0.04) score -= Math.min(2.5, Math.abs(closing) * 10);
    }

    // Proximity — nearer candidates preferred when heading-aligned
    if (distKm < 1) score += 2.2;
    else if (distKm < 3) score += 1.4;
    else if (distKm < 8) score += 0.7;
    else if (distKm > 25) score -= 1.2;

    // Category priors while driving
    if (movingFast) {
      if (place.category === "home" || place.category === "work") score += 0.6;
      if (place.category === "school" && hour >= 7 && hour <= 9) score += 0.8;
    }

    // Visit frequency
    if (place.visitCount >= 10) score += 1.1;
    else if (place.visitCount >= 3) score += 0.5;

    const urbanKmh = Math.max(22, Math.min(70, speed && speed > 8 ? speed : 42));
    const etaMinutes = Math.max(1, Math.round((distKm / urbanKmh) * 60));

    cands.push({ name: place.name, score, distKm, etaMinutes });
  }

  // Also allow habitual labels that aren't exact place rows (legacy trip labels)
  for (const [label, h] of habit) {
    if (cands.some((c) => c.name === label)) continue;
    if (h < 2) continue;
    cands.push({
      name: label,
      score: Math.min(3.5, h),
      distKm: 5,
      etaMinutes: null,
    });
  }

  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  const second = cands[1];

  if (!best || best.score < 2.2) {
    return { label: null, confidence: 0.15, etaMinutes: null };
  }

  // Margin over runner-up matters — close races stay mid confidence.
  const margin = best.score - (second?.score ?? 0);
  // Map score (~2.2–12) → continuous confidence ~0.40–0.96
  let confidence = 0.38 + Math.min(0.5, (best.score - 2.2) / 14);
  if (margin >= 2.5) confidence += 0.1;
  else if (margin >= 1.2) confidence += 0.05;
  else if (margin < 0.5) confidence -= 0.08;

  if (opts.headingDeg == null) confidence -= 0.06; // no compass → less sure
  confidence = Math.max(0.28, Math.min(0.96, Number(confidence.toFixed(2))));

  // Require meaningful confidence before publishing a destination.
  if (confidence < 0.42) {
    return { label: null, confidence, etaMinutes: null };
  }

  return { label: best.name, confidence, etaMinutes: best.etaMinutes };
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
  /** Native shell: app was foregrounded while driving (phone-distraction signal). */
  phoneActiveWhileDriving?: boolean | null;
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
  // Drop GPS teleport glitches (can read as 1000+ km/h).
  speed = sanitizeSpeedKmh(speed);

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

  const prevSpeed = sanitizeSpeedKmh(member.lastSpeedKmh) ?? 0;
  const nextSpeed = sanitizeSpeedKmh(speed) ?? 0;

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
    let phoneUsageEvents =
      ((activeTrip as { phoneUsageEvents?: number }).phoneUsageEvents ?? 0);
    if (prevSpeed - nextSpeed >= HARD_BRAKE_DELTA) hardBraking += 1;
    if (nextSpeed - prevSpeed >= RAPID_ACCEL_DELTA) rapidAcceleration += 1;
    if (opts.phoneActiveWhileDriving && nextSpeed >= 20) phoneUsageEvents += 1;

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
    const priorMax = sanitizeSpeedKmh(activeTrip.maxSpeedKmh) ?? 0;
    const maxSpeedKmh = Math.max(priorMax, nextSpeed);
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
          phoneUsageEvents,
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
          phoneUsageEvents,
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
    prevLat: member.lastLat,
    prevLng: member.lastLng,
    speedKmh: speed,
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

  const inMotion = presence === "driving" || presence === "moving";

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
      likelyDestination: inMotion ? prediction.label : place?.name ?? null,
      // Stationary at a place isn't a prediction — don't leave a stale 55%.
      destinationConfidence: inMotion
        ? prediction.label
          ? prediction.confidence
          : null
        : place
          ? 1
          : null,
      etaMinutes: inMotion ? prediction.etaMinutes : null,
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

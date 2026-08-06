import { prisma } from "@forward/database";
import {
  computeDriveScore,
  isWalkingPaceKmh,
  resolvePresence,
  sanitizeSpeedKmh,
  type FamilyPlaceCategory,
  type MotionActivityHint,
} from "@forward/shared";
import { haversineKm, speedKmhBetween, bearingDeg } from "./geo";
import { sanitizeMotionSpeed, shouldAcceptPinMove } from "./gps-quality";
import {
  asGeofenceShape,
  geofenceMatchDistanceM,
  isInsideGeofence,
} from "./geofence";
import { learnPlaceLeave, learnPlaceVisit } from "./normal-life";
import { notifyHouseholdPlaceTransition, notifyIfStillInsideGeofence } from "./place-alerts";
import { reverseGeocodeLabel, shortCoordLabel } from "./reverse-geocode";
import {
  detectSuddenStopHazard,
  isHardBrakeEvent,
  isRapidAccelEvent,
  notifyHouseholdRoadHazard,
} from "./road-hazards";
import { estimateTripFuelCost, type FuelType } from "./vehicle-fuel";
import { emitLocationEvent } from "./location-events";

const DRIVING_START_KMH = 14;
const DRIVING_END_KMH = 8;
/** Keep breadcrumbs long enough for Month history maps (Life360-style). */
const EVENT_RETENTION_HOURS = 24 * 35;
/** Open an unsaved stop after this many minutes stationary away from a saved place */
const UNSAVED_STOP_MINUTES = 4;
/** Min distance (m) before a new drive can open from a cold start. */
const TRIP_START_MOVE_M = 25;
/** Soft end: parked at a saved place after this many minutes of the drive. */
const TRIP_END_AT_PLACE_MIN = 1.5;
/** Hard end: slow + enough duration even without a saved place. */
const TRIP_END_DWELL_MIN = 4;

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
    // Family map is local — 80km picks made multi-hour "heading home" ETAs.
    if (distKm > 35) continue;

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
    let closingKm = 0;
    if (
      opts.prevLat != null &&
      opts.prevLng != null &&
      Number.isFinite(opts.prevLat) &&
      Number.isFinite(opts.prevLng)
    ) {
      const prevDist = haversineKm(opts.prevLat, opts.prevLng, place.lat, place.lng);
      closingKm = prevDist - distKm;
      if (closingKm > 0.04) score += Math.min(3.5, closingKm * 12); // closing fast
      else if (closingKm < -0.04) score -= Math.min(2.5, Math.abs(closingKm) * 10);
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

    // Never assume crawl speed for ETA — that invented 4-hour "home by midnight".
    const urbanKmh = Math.max(28, Math.min(75, speed && speed > 12 ? speed : 40));
    let etaMinutes = Math.max(1, Math.round((distKm / urbanKmh) * 60));
    if (etaMinutes > 75 && closingKm < 0.05) {
      // Far / not closing — don't publish a scary clock time.
      continue;
    }
    etaMinutes = Math.min(etaMinutes, 90);

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
  speedKmh?: number | null;
}): string {
  if (opts.presence === "driving") {
    if (opts.destination && opts.etaMinutes != null) {
      return `Driving to ${opts.destination} · ETA ${opts.etaMinutes} min`;
    }
    return "Driving";
  }
  if (opts.presence === "moving") {
    // Only foot-speed is "Walking" — 10–15 km/h is not a walk.
    if (!isWalkingPaceKmh(opts.speedKmh ?? null)) {
      return "On the move";
    }
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
  /** Native Core Motion / Activity Recognition (walking wakes GPS). */
  motionActivity?: MotionActivityHint | null;
}) {
  const clientAt = opts.recordedAt ?? new Date();
  const receiveAt = new Date();
  const member = await prisma.familyMember.findUniqueOrThrow({
    where: { id: opts.memberId },
  });

  // Drop clearly older GPS stamps so a cached home fix can't overwrite a newer live fix.
  // Native last-known heartbeats often carry an old pos.timestamp — still refresh
  // liveness with receive time so the household sees "Updated Now".
  // "Updated Xm ago" = last time we heard from the phone, not the GPS clock.
  if (
    opts.recordedAt &&
    member.lastLocationAt &&
    clientAt.getTime() < member.lastLocationAt.getTime() - 3_000
  ) {
    const lastMs = member.lastLocationAt.getTime();
    if (receiveAt.getTime() - lastMs >= 5_000) {
      return prisma.familyMember.update({
        where: { id: opts.memberId },
        data: {
          lastLocationAt: receiveAt,
          ...(opts.batteryPercent != null
            ? { lastBatteryPercent: opts.batteryPercent }
            : {}),
        },
      });
    }
    return member;
  }

  // Prefer the GPS clock for breadcrumbs/trips; lastLocationAt always uses
  // receive time below so deferred last-known can't freeze the UI age.
  const recordedAt = clientAt;
  const sampleAgeMs = Math.max(0, receiveAt.getTime() - clientAt.getTime());

  // Very inaccurate stationary samples often jitter inside a home geofence.
  // Do NOT move the pin — but DO refresh liveness. Rejecting these entirely
  // froze lastLocationAt at home ("Updated 7m ago") while phones kept posting.
  // Also treat large jumps with terrible accuracy as heartbeats only (indoor
  // multipath) so we don't bounce the pin or skip liveness.
  const accuracy = opts.accuracyM ?? null;
  const inaccurate =
    accuracy != null && accuracy > 120 && (opts.speedKmh == null || opts.speedKmh < 1.5);
  if (inaccurate && member.lastLat != null && member.lastLng != null) {
    const jumpM =
      haversineKm(member.lastLat, member.lastLng, opts.lat, opts.lng) * 1000;
    if (jumpM < 80 || accuracy > 200) {
      const lastMs = member.lastLocationAt?.getTime() ?? 0;
      if (receiveAt.getTime() - lastMs >= 5_000) {
        return prisma.familyMember.update({
          where: { id: opts.memberId },
          data: {
            lastLocationAt: receiveAt,
            ...(opts.batteryPercent != null
              ? { lastBatteryPercent: opts.batteryPercent }
              : {}),
          },
        });
      }
      return member;
    }
  }

  let speed = opts.speedKmh ?? null;
  const fixAgeMs = sampleAgeMs;

  const movedM =
    member.lastLat != null && member.lastLng != null
      ? haversineKm(member.lastLat, member.lastLng, opts.lat, opts.lng) * 1000
      : null;
  // Prefer receive-clock Δt for move gating — lastLocationAt is always stamped
  // on accept/heartbeat, while GPS recordedAt can jump backward/forward.
  const dtSec =
    member.lastLocationAt != null
      ? Math.max(0.5, (receiveAt.getTime() - member.lastLocationAt.getTime()) / 1000)
      : null;
  const moveBearing =
    member.lastLat != null && member.lastLng != null && movedM != null && movedM >= 5
      ? bearingDeg(member.lastLat, member.lastLng, opts.lat, opts.lng)
      : null;

  // Stale Doppler while sitting still — BUT if the pin clearly moved, trust
  // displacement. Hard-zeroing deferred BG samples was keeping people "At Home"
  // through entire Tim Hortons runs.
  if (fixAgeMs > 20_000 && (speed == null || speed < 55)) {
    if (movedM != null && dtSec != null && movedM >= 40 && dtSec >= 3) {
      speed = speedKmhBetween(
        member.lastLat!,
        member.lastLng!,
        member.lastLocationAt!,
        opts.lat,
        opts.lng,
        receiveAt
      );
    } else {
      speed = 0;
    }
  }

  // Only invent speed from displacement when the client omitted it AND the
  // jump is larger than GPS noise. Tiny park/indoor jitters were ~15 km/h.
  if (
    speed == null &&
    member.lastLat != null &&
    member.lastLng != null &&
    member.lastLocationAt &&
    movedM != null &&
    dtSec != null
  ) {
    const noiseFloorM = Math.max(30, (accuracy ?? 40) * 0.85);
    if (movedM >= noiseFloorM && dtSec >= 4) {
      speed = speedKmhBetween(
        member.lastLat,
        member.lastLng,
        member.lastLocationAt,
        opts.lat,
        opts.lng,
        receiveAt
      );
    } else {
      speed = 0;
    }
  }

  // Drop GPS teleport glitches (can read as 1000+ km/h).
  speed = sanitizeSpeedKmh(speed);

  // Tighten: driving-class Doppler must be backed by real pin movement.
  // Fixes Hamoudi-style “42 km/h” while the pin sits over houses.
  speed = sanitizeMotionSpeed({
    speedKmh: speed,
    movedM,
    dtSec,
    accuracyM: accuracy,
  });

  // If Doppler is still flat but the pin walked ~25m+, invent walking speed
  // from displacement so resolvePresence / labels can say Walking.
  // (10m was inventing walks from sitting GPS multipath after login.)
  if (
    (speed == null || speed < 1.5) &&
    movedM != null &&
    dtSec != null &&
    dtSec >= 6 &&
    dtSec <= 120 &&
    movedM >= 25
  ) {
    const dispKmh = movedM / 1000 / (dtSec / 3600);
    if (Number.isFinite(dispKmh) && dispKmh >= 1.4 && dispKmh < 9) {
      speed = Math.round(dispKmh * 10) / 10;
    }
  }

  // Reject teleports / reverse snaps — keep last good pin, refresh liveness only.
  // Driving uses a looser gate so sparse highway hops aren't frozen (Zeinab
  // Tecumseh lag/jump: reject → heartbeat → next hop looks like a teleport).
  const prevPresenceHint = (member.presenceStatus ?? "unknown") as
    | "stationary"
    | "moving"
    | "driving"
    | "unknown";
  const acceptPin = shouldAcceptPinMove({
    movedM,
    dtSec,
    accuracyM: accuracy,
    prevAccuracyM: member.lastAccuracyM ?? null,
    prevHeadingDeg: member.lastHeadingDeg ?? null,
    moveBearingDeg: moveBearing,
    sanitizedSpeedKmh: speed,
    presenceHint: prevPresenceHint,
  });
  if (!acceptPin && member.lastLat != null && member.lastLng != null) {
    const lastMs = member.lastLocationAt?.getTime() ?? 0;
    if (receiveAt.getTime() - lastMs < 4_000) return member;
    // Don't move the pin, don't invent Walking from leftover Doppler on a
    // rejected hop — that made sitting look like a walk right after login.
    // Keep prior driving presence so the next hop still gets highway gates.
    const holdSpeed =
      prevPresenceHint === "driving" && speed != null && speed >= 8 ? speed : 0;
    const holdPresence =
      prevPresenceHint === "driving" || holdSpeed >= 12 ? "driving" : "stationary";
    return prisma.familyMember.update({
      where: { id: opts.memberId },
      data: {
        lastLocationAt: receiveAt,
        lastSpeedKmh: holdSpeed,
        presenceStatus: holdPresence,
        statusLabel:
          holdPresence === "driving"
            ? "Driving"
            : member.statusLabel?.startsWith("At ")
              ? member.statusLabel
              : "Stationary",
        ...(opts.batteryPercent != null
          ? { lastBatteryPercent: opts.batteryPercent }
          : {}),
      },
    });
  }

  const prevPresence = (member.presenceStatus ?? "unknown") as
    | "stationary"
    | "moving"
    | "driving"
    | "unknown";
  const presence = resolvePresence({
    speedKmh: speed,
    movedM,
    dtSec,
    activity: opts.motionActivity ?? null,
    previousPresence: prevPresence,
  });
  // While clearly in motion — or clearly outside the last geofence — don't stay
  // attached to Home. Short neighborhood drives were stuck "At Home" when speed
  // sanitized to 0 but lat/lng had already left the fence.
  // Walks also detach gently once they've moved ~45m so "At Home" doesn't stick
  // through a neighborhood stroll.
  const placeRaw = await findPlaceAt(opts.householdId, opts.lat, opts.lng);
  const leftLastPlace =
    member.currentPlaceId != null &&
    placeRaw?.id !== member.currentPlaceId &&
    movedM != null &&
    movedM >= 80;
  const walkingAwayFromPlace =
    presence === "moving" &&
    isWalkingPaceKmh(speed) &&
    movedM != null &&
    movedM >= 45;
  const place =
    presence === "driving" ||
    (presence === "moving" && (speed ?? 0) >= 8) ||
    leftLastPlace ||
    walkingAwayFromPlace
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

  // ── Trip state machine ──────────────────────────────────────────────
  // States: idle → in_trip → ended (opens a stay). Thresholds live above
  // so enter/exit aren't buried in nested conditionals.
  const activeTrip = await prisma.familyTrip.findFirst({
    where: { memberId: opts.memberId, isActive: true },
    orderBy: { startedAt: "desc" },
  });

  const prevSpeed = sanitizeSpeedKmh(member.lastSpeedKmh) ?? 0;
  const nextSpeed = sanitizeSpeedKmh(speed) ?? 0;
  // Reuse `dtSec` from the displacement block above for rate-based events.

  const shouldStartTrip =
    !activeTrip &&
    // Real travel opens a drive — don't require a prior speed ramp (first sample
    // leaving Home often has prevSpeed=0 and missed Tim Hortons loops).
    ((nextSpeed >= DRIVING_START_KMH && movedM != null && movedM >= TRIP_START_MOVE_M) ||
      (nextSpeed >= 12 && movedM != null && movedM >= 60) ||
      (movedM != null && movedM >= 120 && dtSec != null && dtSec <= 180));

  if (shouldStartTrip) {
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
    // Rate-based events — absolute km/h deltas spam with dense 0.5–1s GPS.
    if (
      dtSec != null &&
      isHardBrakeEvent({
        prevSpeedKmh: prevSpeed,
        nextSpeedKmh: nextSpeed,
        dtSec,
        accuracyM: opts.accuracyM ?? null,
      })
    ) {
      hardBraking += 1;
    }
    if (
      dtSec != null &&
      isRapidAccelEvent({
        prevSpeedKmh: prevSpeed,
        nextSpeedKmh: nextSpeed,
        dtSec,
        accuracyM: opts.accuracyM ?? null,
      })
    ) {
      rapidAcceleration += 1;
    }

    const hazard = detectSuddenStopHazard({
      displayName: member.displayName,
      prevSpeedKmh: prevSpeed,
      nextSpeedKmh: nextSpeed,
      hardBrakingThisTrip: hardBraking,
      dtSec,
      accuracyM: opts.accuracyM ?? null,
    });
    if (hazard) {
      // Only count sudden_stop against the trip score — cluster is a heads-up,
      // not a second penalty for the same brakes we already counted.
      if (hazard.kind === "sudden_stop") unusualRouteEvents += 1;
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
      durationMinutes >= TRIP_END_AT_PLACE_MIN &&
      (place != null ||
        durationMinutes >= TRIP_END_DWELL_MIN ||
        (presence === "stationary" && distanceKm >= 0.2));

    if (shouldEnd) {
      const fuel =
        member.fuelType || member.vehicleMake
          ? estimateTripFuelCost({
              distanceKm,
              fuelType: (["gas", "diesel", "hybrid", "ev"].includes(member.fuelType ?? "")
                ? member.fuelType
                : "gas") as FuelType,
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

      emitLocationEvent({
        type: "trip.ended",
        payload: {
          householdId: opts.householdId,
          actorMemberId: opts.memberId,
          actorDisplayName: member.displayName,
          userId: member.userId,
          tripId: activeTrip.id,
          fromLabel: activeTrip.fromLabel,
          toLabel,
          distanceKm,
          durationMinutes,
          driveScore,
          estimatedFuelCostCad: fuel.costCad,
          endedAt: recordedAt,
          shareDrivingData: member.shareDrivingData,
          shareDigitalTwinIntegration: member.shareDigitalTwinIntegration !== false,
        },
      });

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
    prevLat: member.lastLat,
    prevLng: member.lastLng,
    speedKmh: speed,
  });

  const statusLabel = statusLabelFor({
    presence,
    placeName: place?.name ?? null,
    destination: prediction.label,
    etaMinutes: prediction.etaMinutes,
    speedKmh: speed,
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
      // Always stamp liveness with receive time. GPS `recordedAt` can be minutes
      // old on deferred/last-known samples and was freezing "Updated Xm ago".
      lastLocationAt: receiveAt,
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

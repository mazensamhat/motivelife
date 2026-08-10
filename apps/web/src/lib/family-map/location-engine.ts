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
import {
  COUNT_AGGRESSIVE_GPS_EVENTS,
  PHONE_USE_COOLDOWN_MS,
  PHONE_USE_MIN_SPEED_KMH,
} from "./telematics-policy";
import { estimateTripFuelCost, type FuelType } from "./vehicle-fuel";
import { emitLocationEvent } from "./location-events";
import { pruneMemberLocationHistoryAfterIngest } from "./location-history-retention";

/** Per-member cooldown for phone-in-use ticks while driving. */
const lastPhoneUseAt = new Map<string, number>();

const DRIVING_START_KMH = 14;
const DRIVING_END_KMH = 8;
/** Open an unsaved stop after this many minutes stationary away from a saved place */
const UNSAVED_STOP_MINUTES = 4;
/** Min distance (m) before a new drive can open from a cold start. */
const TRIP_START_MOVE_M = 25;
/** Soft end: parked at a saved place after this many minutes of the drive. */
const TRIP_END_AT_PLACE_MIN = 1.5;
/** Hard end: slow + enough duration even without a saved place. */
const TRIP_END_DWELL_MIN = 4;
/**
 * Active stays older than this are treated as abandoned junk (app kill / race).
 * Prevents "left Work after 1335 min" when a leftover Stop from yesterday is closed.
 */
const STALE_ACTIVE_VISIT_MS = 12 * 60 * 60_000;
/** Don't seed unsaved-stop arrivedAt from a place-entered hint older than this. */
const MAX_ENTERED_HINT_AGE_MS = 6 * 60 * 60_000;
/** Cap dwell used for leave alerts / learning so absurd values never ship. */
const MAX_ALERT_DWELL_MIN = 16 * 60;

function minutesBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
}

/** Clear stuck driving/ETA fields on heartbeat-only updates (no pin move). */
function motionDecayFields(member: {
  presenceStatus: string | null;
  lastSpeedKmh: number | null;
  likelyDestination: string | null;
  etaMinutes: number | null;
  statusLabel: string | null;
  currentPlaceId: string | null;
}) {
  const stuck =
    member.presenceStatus === "driving" ||
    member.presenceStatus === "moving" ||
    (member.lastSpeedKmh != null && member.lastSpeedKmh >= 1.5) ||
    member.likelyDestination != null ||
    member.etaMinutes != null;
  if (!stuck) return null;
  return {
    presenceStatus: "stationary" as const,
    lastSpeedKmh: 0,
    lastHeadingDeg: null,
    likelyDestination: null as string | null,
    destinationConfidence: null as number | null,
    etaMinutes: null as number | null,
    statusLabel: member.statusLabel?.startsWith("At ")
      ? member.statusLabel
      : "Stationary",
  };
}

/**
 * Close an active trip left open when motion froze (rejected multipath /
 * inaccurate heartbeats). Junk loops are deleted; real drives get a quiet end.
 */
async function quietEndActiveTrip(opts: {
  memberId: string;
  lat: number;
  lng: number;
  at: Date;
  placeName?: string | null;
}) {
  const trip = await prisma.familyTrip.findFirst({
    where: { memberId: opts.memberId, isActive: true },
    orderBy: { startedAt: "desc" },
  });
  if (!trip) return;
  const durationMinutes = Math.max(
    0.1,
    (opts.at.getTime() - trip.startedAt.getTime()) / 60_000
  );
  const junk =
    trip.distanceKm < 0.25 ||
    (durationMinutes < 3 && trip.distanceKm < 1.0) ||
    (durationMinutes < 8 &&
      trip.distanceKm < 2.5 &&
      opts.placeName != null &&
      trip.fromLabel.trim().toLowerCase() === opts.placeName.trim().toLowerCase());
  if (junk) {
    await prisma.familyTrip.delete({ where: { id: trip.id } }).catch(() => null);
    return;
  }
  await prisma.familyTrip
    .update({
      where: { id: trip.id },
      data: {
        toLabel: opts.placeName?.trim() || "Stopped",
        endLat: opts.lat,
        endLng: opts.lng,
        durationMinutes,
        endedAt: opts.at,
        isActive: false,
      },
    })
    .catch(() => null);
}

/** Prefer the member's currentPlaceEnteredAt when the visit row is stale junk. */
function saneDwellMinutes(
  arrivedAt: Date,
  departedAt: Date,
  enteredAt?: Date | null
): number {
  let start = arrivedAt;
  if (
    enteredAt &&
    (enteredAt.getTime() > arrivedAt.getTime() ||
      arrivedAt.getTime() < enteredAt.getTime() - 30 * 60_000)
  ) {
    start = enteredAt;
  }
  let mins = minutesBetween(start, departedAt);
  if (mins > MAX_ALERT_DWELL_MIN) {
    if (enteredAt) mins = minutesBetween(enteredAt, departedAt);
    mins = Math.min(mins, MAX_ALERT_DWELL_MIN);
  }
  return mins;
}

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
  /**
   * True when the MotiveLife app is in the foreground (screen in use).
   * Combined with driving speed → phoneUsageEvents on the active trip.
   */
  phoneInUse?: boolean | null;
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
  //
  // Compare against the last *GPS* breadcrumb clock (not receive lastLocationAt).
  // Receive time always advances on heartbeats, so GPS→receive checks had a hole
  // where a 1–2s older last-known could still move the pin backward mid-drive.
  let lastGpsRecordedAt: Date | null = null;
  if (opts.recordedAt) {
    try {
      const lastEvent = await prisma.familyLocationEvent.findFirst({
        where: { memberId: opts.memberId },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      });
      lastGpsRecordedAt = lastEvent?.recordedAt ?? null;
    } catch {
      lastGpsRecordedAt = null;
    }
  }
  const staleVsGps =
    opts.recordedAt &&
    lastGpsRecordedAt &&
    clientAt.getTime() < lastGpsRecordedAt.getTime() - 1_500;
  const staleVsReceive =
    opts.recordedAt &&
    member.lastLocationAt &&
    clientAt.getTime() < member.lastLocationAt.getTime() - 3_000;
  if (staleVsGps || staleVsReceive) {
    const lastMs = member.lastLocationAt?.getTime() ?? 0;
    if (receiveAt.getTime() - lastMs >= 5_000) {
      const decay = motionDecayFields(member);
      if (
        decay &&
        member.lastLat != null &&
        member.lastLng != null &&
        (member.presenceStatus === "driving" ||
          (member.lastSpeedKmh != null && member.lastSpeedKmh >= 8))
      ) {
        const stopPlace = await findPlaceAt(
          opts.householdId,
          member.lastLat,
          member.lastLng
        );
        await quietEndActiveTrip({
          memberId: opts.memberId,
          lat: member.lastLat,
          lng: member.lastLng,
          at: receiveAt,
          placeName: stopPlace?.name ?? null,
        });
      }
      return prisma.familyMember.update({
        where: { id: opts.memberId },
        data: {
          // Do NOT refresh lastLocationAt on stale replay — old GPS clocks
          // must not fake "Updated Now" or revive a frozen drive.
          ...(decay ?? {}),
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
        const decay = motionDecayFields(member);
        // Clear ghost trips while parked under bad accuracy — refresh liveness
        // so "Updated Xm ago" doesn't freeze, but never move the pin.
        if (
          decay &&
          (member.presenceStatus === "driving" ||
            (member.lastSpeedKmh != null && member.lastSpeedKmh >= 8))
        ) {
          const stopPlace = await findPlaceAt(
            opts.householdId,
            member.lastLat,
            member.lastLng
          );
          await quietEndActiveTrip({
            memberId: opts.memberId,
            lat: member.lastLat,
            lng: member.lastLng,
            at: receiveAt,
            placeName: stopPlace?.name ?? null,
          });
        }
        return prisma.familyMember.update({
          where: { id: opts.memberId },
          data: {
            ...(decay ?? {}),
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

  // Stale Doppler while sitting still. Only invent from displacement when the
  // client OMITTED speed — never overwrite an intentional 0 from the phone.
  if (fixAgeMs > 20_000) {
    if (speed == null) {
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
    } else if (speed > 0 && speed < 55) {
      // Client sent a low leftover Doppler on an old fix — trust move or zero.
      if (!(movedM != null && dtSec != null && movedM >= 40 && dtSec >= 3)) {
        speed = 0;
      }
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
    // Rejected hop while parked / multipath: decay stuck driving + refresh
    // liveness. Do NOT decay on a true highway teleport reject (speed still
    // high and a large hop) — that would kill a live drive mid-route.
    const parkingReject =
      (speed ?? 0) < 8 ||
      (movedM != null && movedM < 35) ||
      (accuracy != null && accuracy > 80);
    const decay = parkingReject ? motionDecayFields(member) : null;
    if (
      decay &&
      (member.presenceStatus === "driving" ||
        (member.lastSpeedKmh != null && member.lastSpeedKmh >= 8) ||
        (speed ?? 0) < 8)
    ) {
      const stopPlace = await findPlaceAt(
        opts.householdId,
        member.lastLat,
        member.lastLng
      );
      await quietEndActiveTrip({
        memberId: opts.memberId,
        lat: member.lastLat,
        lng: member.lastLng,
        at: receiveAt,
        placeName: stopPlace?.name ?? null,
      });
    }
    return prisma.familyMember.update({
      where: { id: opts.memberId },
      data: {
        ...(decay ?? {}),
        lastLocationAt: receiveAt,
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
  let presence = resolvePresence({
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
  // Parked inside a geofence must attach even if presence still says driving —
  // otherwise we never "arrive" and keep a blue ETA route forever.
  const parkedAtPlace =
    placeRaw != null &&
    (speed ?? 0) < DRIVING_END_KMH &&
    (movedM == null || movedM < 25);
  if (parkedAtPlace) {
    presence = "stationary";
    speed = 0;
  }
  const place = parkedAtPlace
    ? placeRaw
    : presence === "driving" ||
        (presence === "moving" && (speed ?? 0) >= 8) ||
        leftLastPlace ||
        walkingAwayFromPlace
      ? null
      : placeRaw;
  const placeChanged = (place?.id ?? null) !== (member.currentPlaceId ?? null);
  let nextPlaceEnteredAt: Date | null | undefined = undefined;

  /**
   * Close every open stay for this member (races can leave more than one).
   * Dwell for leave alerts comes from the visit that matches the place we're
   * leaving (or the newest stay) — never from an abandoned 22h-old leftover.
   */
  async function closeActiveVisit(departedAt: Date, endLat: number, endLng: number) {
    const actives = await prisma.familyPlaceVisit.findMany({
      where: { memberId: opts.memberId, isActive: true },
      orderBy: { arrivedAt: "desc" },
    });
    if (!actives.length) return null;

    const leavingPlaceId = member.currentPlaceId ?? null;
    const primary =
      (leavingPlaceId
        ? actives.find((a) => a.placeId === leavingPlaceId)
        : null) ??
      actives.find(
        (a) => departedAt.getTime() - a.arrivedAt.getTime() < STALE_ACTIVE_VISIT_MS
      ) ??
      actives[0]!;

    let primaryDwell = 1;
    for (const active of actives) {
      const isPrimary = active.id === primary.id;
      const dwellMinutes = isPrimary
        ? saneDwellMinutes(active.arrivedAt, departedAt, member.currentPlaceEnteredAt)
        : // Race leftovers: don't credit a multi-hour dwell to junk rows.
          Math.min(
            30,
            saneDwellMinutes(active.arrivedAt, departedAt, null)
          );
      if (isPrimary) primaryDwell = dwellMinutes;
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
    }
    return { ...primary, dwellMinutes: primaryDwell };
  }

  if (placeChanged) {
    // Concurrent GPS posts (web + native) can open many active stays for the
    // same park. Prefer an existing open stay at the destination before
    // closing/creating, then always collapse to a single active row.
    const alreadyAtDestinationRaw = place
      ? await prisma.familyPlaceVisit.findFirst({
          where: {
            memberId: opts.memberId,
            isActive: true,
            OR: [{ placeId: place.id }, { placeName: place.name }],
          },
          orderBy: { arrivedAt: "desc" },
          select: { id: true, arrivedAt: true },
        })
      : null;
    // Abandoned actives from yesterday must not be "reused" as today's stay.
    const alreadyAtDestination =
      alreadyAtDestinationRaw &&
      recordedAt.getTime() - alreadyAtDestinationRaw.arrivedAt.getTime() <
        STALE_ACTIVE_VISIT_MS
        ? alreadyAtDestinationRaw
        : null;

    if (alreadyAtDestination) {
      await prisma.familyPlaceVisit.updateMany({
        where: {
          memberId: opts.memberId,
          isActive: true,
          id: { not: alreadyAtDestination.id },
        },
        data: {
          isActive: false,
          departedAt: recordedAt,
          dwellMinutes: 1,
        },
      });
      nextPlaceEnteredAt = alreadyAtDestination.arrivedAt;
    } else {
      // Close previous stay (saved place or unsaved stop).
      const closed = await closeActiveVisit(recordedAt, opts.lat, opts.lng);
      if (member.currentPlaceId) {
        const prev = await prisma.familyPlace.findUnique({
          where: { id: member.currentPlaceId },
        });
        const dwellMinutes =
          closed?.dwellMinutes ??
          saneDwellMinutes(
            member.currentPlaceEnteredAt ?? recordedAt,
            recordedAt,
            member.currentPlaceEnteredAt
          );
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
          await notifyHouseholdPlaceTransition({
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
        // Collapse same-tick race creates — keep the newest open stay at place.
        const keep = await prisma.familyPlaceVisit.findFirst({
          where: {
            memberId: opts.memberId,
            isActive: true,
            OR: [{ placeId: place.id }, { placeName: place.name }],
          },
          orderBy: { arrivedAt: "desc" },
          select: { id: true, arrivedAt: true },
        });
        if (keep) {
          await prisma.familyPlaceVisit.updateMany({
            where: {
              memberId: opts.memberId,
              isActive: true,
              id: { not: keep.id },
            },
            data: {
              isActive: false,
              departedAt: recordedAt,
              dwellMinutes: 1,
            },
          });
          nextPlaceEnteredAt = keep.arrivedAt;
        } else {
          nextPlaceEnteredAt = recordedAt;
        }
        await notifyHouseholdPlaceTransition({
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
    let enteredHint = member.currentPlaceEnteredAt ?? member.lastLocationAt;
    if (
      enteredHint &&
      recordedAt.getTime() - enteredHint.getTime() > MAX_ENTERED_HINT_AGE_MS
    ) {
      // Stale hint would invent a 22h "At Stop" — start fresh from recent dwell.
      enteredHint = new Date(
        recordedAt.getTime() - UNSAVED_STOP_MINUTES * 60_000
      );
    }
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
  } else {
    // Same place — collapse leftover duplicate / abandoned actives.
    const actives = await prisma.familyPlaceVisit.findMany({
      where: { memberId: opts.memberId, isActive: true },
      orderBy: { arrivedAt: "desc" },
      select: { id: true, placeId: true, placeName: true, arrivedAt: true },
      take: 20,
    });
    if (actives.length) {
      const preferred =
        actives.find(
          (a) =>
            recordedAt.getTime() - a.arrivedAt.getTime() < STALE_ACTIVE_VISIT_MS &&
            ((place?.id && a.placeId === place.id) ||
              (place?.name && a.placeName === place.name))
        ) ??
        actives.find(
          (a) => recordedAt.getTime() - a.arrivedAt.getTime() < STALE_ACTIVE_VISIT_MS
        ) ??
        null;

      const dropIds = actives
        .filter((a) => !preferred || a.id !== preferred.id)
        .map((a) => a.id);
      if (dropIds.length) {
        await prisma.familyPlaceVisit.updateMany({
          where: { id: { in: dropIds } },
          data: {
            isActive: false,
            departedAt: recordedAt,
            dwellMinutes: 1,
          },
        });
      }
      if (preferred) nextPlaceEnteredAt = preferred.arrivedAt;
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
    // Real travel opens a drive — require speed OR displacement pace so a
    // naked 120m multipath hop can't invent a ghost trip while parked.
    ((nextSpeed >= DRIVING_START_KMH && movedM != null && movedM >= TRIP_START_MOVE_M) ||
      (nextSpeed >= 12 && movedM != null && movedM >= 60) ||
      (nextSpeed >= 12 &&
        movedM != null &&
        movedM >= 120 &&
        dtSec != null &&
        dtSec <= 180));

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
    // Aggressive GPS telematics are paused — keep historical columns at 0 for
    // new trips so Drive Score stays trustworthy (top speed + phone-in-use).
    let hardBraking = COUNT_AGGRESSIVE_GPS_EVENTS ? activeTrip.hardBraking : 0;
    let rapidAcceleration = COUNT_AGGRESSIVE_GPS_EVENTS
      ? activeTrip.rapidAcceleration
      : 0;
    let unusualRouteEvents = COUNT_AGGRESSIVE_GPS_EVENTS
      ? activeTrip.unusualRouteEvents
      : 0;
    let phoneUsageEvents =
      (activeTrip as { phoneUsageEvents?: number }).phoneUsageEvents ?? 0;

    if (COUNT_AGGRESSIVE_GPS_EVENTS) {
      if (
        dtSec != null &&
        isHardBrakeEvent({
          prevSpeedKmh: prevSpeed,
          nextSpeedKmh: nextSpeed,
          dtSec,
          accuracyM: opts.accuracyM ?? null,
          movedM,
          memberKey: opts.memberId,
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
          movedM,
          memberKey: opts.memberId,
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
        movedM,
      });
      if (hazard) {
        if (hazard.kind === "sudden_stop") unusualRouteEvents += 1;
        await notifyHouseholdRoadHazard({
          householdId: opts.householdId,
          actorMemberId: opts.memberId,
          actorDisplayName: member.displayName,
          signal: hazard,
        }).catch(() => undefined);
      }
    }

    // Phone in use while driving — app foreground at driving speed.
    if (
      opts.phoneInUse === true &&
      nextSpeed >= PHONE_USE_MIN_SPEED_KMH
    ) {
      const last = lastPhoneUseAt.get(opts.memberId) ?? 0;
      const nowMs = recordedAt.getTime();
      if (nowMs - last >= PHONE_USE_COOLDOWN_MS) {
        phoneUsageEvents += 1;
        lastPhoneUseAt.set(opts.memberId, nowMs);
      }
    }

    const sampleCount = activeTrip.sampleCount + 1;
    const speedSum = activeTrip.speedSum + nextSpeed;
    const priorMax = sanitizeSpeedKmh(activeTrip.maxSpeedKmh) ?? 0;
    // Reject GPS teleport spikes (e.g. single ping at 195 km/h).
    let maxSpeedKmh = priorMax;
    if (nextSpeed > priorMax) {
      const jump = nextSpeed - priorMax;
      const okAccuracy = opts.accuracyM == null || opts.accuracyM <= 35;
      const sustained =
        jump <= 30 ||
        (dtSec != null && dtSec >= 8 && jump <= 50) ||
        (sampleCount >= 4 && jump <= 40);
      if (okAccuracy && sustained) {
        maxSpeedKmh = nextSpeed;
      }
    }
    const avgSpeedKmh = speedSum / sampleCount;
    const driveScore = computeDriveScore({
      hardBraking,
      rapidAcceleration,
      unusualRouteEvents,
      maxSpeedKmh,
      phoneUsageEvents,
    });

    const shouldEnd =
      nextSpeed < DRIVING_END_KMH &&
      durationMinutes >= (parkedAtPlace ? 0.75 : TRIP_END_AT_PLACE_MIN) &&
      (place != null ||
        placeRaw != null ||
        parkedAtPlace ||
        durationMinutes >= TRIP_END_DWELL_MIN ||
        (presence === "stationary" && distanceKm >= 0.2));

    if (shouldEnd) {
      const endPlace = place ?? placeRaw;
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
      let toLabel = endPlace?.name ?? null;
      if (!toLabel) {
        const geo = await reverseGeocodeLabel(opts.lat, opts.lng);
        toLabel = geo.label || shortCoordLabel(opts.lat, opts.lng);
      }

      const sameEndpoint =
        activeTrip.fromLabel.trim().toLowerCase() === toLabel.trim().toLowerCase();
      // GPS drift while parked (Home → Home / same-street loops) — drop the junk trip.
      const junkLoop =
        distanceKm < 0.25 ||
        (sameEndpoint && distanceKm < 1.2) ||
        (sameEndpoint && durationMinutes < 8 && distanceKm < 2.5);

      if (junkLoop) {
        await prisma.familyTrip.delete({ where: { id: activeTrip.id } }).catch(() => null);
        // Still open a stay when parked at a saved place, without a fake drive row.
        const alreadyThere = await prisma.familyPlaceVisit.findFirst({
          where: { memberId: opts.memberId, isActive: true },
          select: { id: true },
        });
        if (!alreadyThere && endPlace) {
          await prisma.familyPlaceVisit.create({
            data: {
              memberId: opts.memberId,
              placeId: endPlace.id,
              placeName: endPlace.name,
              lat: endPlace.lat,
              lng: endPlace.lng,
              arrivedAt: recordedAt,
              isActive: true,
              dwellMinutes: 0,
            },
          });
          nextPlaceEnteredAt = recordedAt;
          await notifyHouseholdPlaceTransition({
            householdId: opts.householdId,
            actorMemberId: opts.memberId,
            actorDisplayName: member.displayName,
            placeName: endPlace.name,
            placeId: endPlace.id,
            kind: "arrived",
          }).catch(() => undefined);
        }
      } else {
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

        await emitLocationEvent({
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
              placeId: endPlace?.id ?? null,
              placeName: toLabel,
              lat: endPlace?.lat ?? opts.lat,
              lng: endPlace?.lng ?? opts.lng,
              arrivedAt: recordedAt,
              isActive: true,
              dwellMinutes: 0,
            },
          });
          nextPlaceEnteredAt = recordedAt;
          if (endPlace) {
            await notifyHouseholdPlaceTransition({
              householdId: opts.householdId,
              actorMemberId: opts.memberId,
              actorDisplayName: member.displayName,
              placeName: endPlace.name,
              placeId: endPlace.id,
              kind: "arrived",
            }).catch(() => undefined);
          }
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

  // Destination / ETA only while actually driving — walking "On the move"
  // must not keep a blue route or "Driving to Home · ETA".
  const prediction =
    presence === "driving" && (speed ?? 0) >= DRIVING_END_KMH
      ? await predictDestination({
          memberId: opts.memberId,
          householdId: opts.householdId,
          fromPlaceName: place?.name ?? null,
          lat: opts.lat,
          lng: opts.lng,
          headingDeg: opts.headingDeg ?? null,
          prevLat: member.lastLat,
          prevLng: member.lastLng,
          speedKmh: speed,
        })
      : { label: null as string | null, confidence: 0, etaMinutes: null as number | null };

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

  // Cap breadcrumbs (~35d) and finished trips/stays (max 365d) so DB growth stays bounded.
  await pruneMemberLocationHistoryAfterIngest(opts.memberId);

  // Geofence “hasn’t left yet” when still dwelling past usual leave
  if (place && presence === "stationary") {
    await notifyIfStillInsideGeofence({
      householdId: opts.householdId,
      actorMemberId: opts.memberId,
      actorDisplayName: member.displayName,
      placeId: place.id,
      placeName: place.name,
    }).catch(() => undefined);
  }

  const drivingNow = presence === "driving" && (speed ?? 0) >= DRIVING_END_KMH;

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
      likelyDestination: drivingNow
        ? prediction.label
        : place?.name ?? null,
      // Stationary at a place isn't a prediction — don't leave a stale 55%.
      destinationConfidence: drivingNow
        ? prediction.label
          ? prediction.confidence
          : null
        : place
          ? 1
          : null,
      etaMinutes: drivingNow ? prediction.etaMinutes : null,
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

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
import {
  inventSpeedFromDisplacement,
  MAX_STATIONARY_CATCHUP_M,
  sanitizeMotionSpeed,
  shouldAcceptPinMove,
} from "./gps-quality";
import {
  asGeofenceShape,
  geofenceMatchDistanceM,
  isHardEscapeFromPlace,
  isInsideGeofence,
  isInsideGeofenceSticky,
} from "./geofence";
import { learnPlaceLeave, learnPlaceVisit, habitualDestinationsFor } from "./normal-life";
import { snapLabelToPlace } from "./history";
import { notifyHouseholdPlaceTransition, notifyIfStillInsideGeofence } from "./place-alerts";
import { confirmPlaceTransition, resetPlaceTransitionPending } from "./place-transition";
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
import {
  isClearVehicleThroughWorkout,
  isWorkoutPlace,
  workoutPresenceLabel,
} from "./workout-presence";

/** Per-member cooldown for phone-in-use ticks while driving. */
const lastPhoneUseAt = new Map<string, number>();

const DRIVING_START_KMH = 14;
const DRIVING_END_KMH = 8;
/** Open an unsaved stop after this many minutes stationary away from a saved place */
const UNSAVED_STOP_MINUTES = 4;
/** Min distance (m) before a new drive can open from a cold start. */
const TRIP_START_MOVE_M = 25;
/** Soft end: parked at a saved place after this many minutes of the drive. */
const TRIP_END_AT_PLACE_MIN = 0.75;
/** Hard end: slow + enough duration even without a saved place. */
const TRIP_END_DWELL_MIN = 1.75;
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
  householdId?: string | null;
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
  let placeName = opts.placeName?.trim() || null;
  if (!placeName && opts.householdId) {
    const near = await findPlaceAt(opts.householdId, opts.lat, opts.lng);
    placeName = near?.name ?? null;
  }
  const junk =
    trip.distanceKm < 0.25 ||
    (durationMinutes < 3 && trip.distanceKm < 1.0) ||
    (durationMinutes < 8 &&
      trip.distanceKm < 2.5 &&
      placeName != null &&
      trip.fromLabel.trim().toLowerCase() === placeName.trim().toLowerCase());
  if (junk) {
    await prisma.familyTrip.delete({ where: { id: trip.id } }).catch(() => null);
    return;
  }
  await prisma.familyTrip
    .update({
      where: { id: trip.id },
      data: {
        toLabel: placeName || "Stopped",
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
  rotationDeg?: number | null;
  aspectRatio?: number | null;
};

export async function findPlaceAt(
  householdId: string,
  lat: number,
  lng: number,
  opts?: {
    /** Stay attached to this place until past exit hysteresis. */
    stickyPlaceId?: string | null;
    accuracyM?: number | null;
  }
): Promise<PlaceRow | null> {
  const places = await prisma.familyPlace.findMany({ where: { householdId } });
  const stickyId = opts?.stickyPlaceId ?? null;
  const accuracyM = opts?.accuracyM ?? null;

  if (stickyId) {
    const sticky = places.find((p) => p.id === stickyId) ?? null;
    if (sticky) {
      const shape = asGeofenceShape(sticky.shape);
      const rotationDeg =
        typeof (sticky as { rotationDeg?: number | null }).rotationDeg === "number"
          ? (sticky as { rotationDeg: number }).rotationDeg
          : 0;
      const aspectRatio =
        typeof (sticky as { aspectRatio?: number | null }).aspectRatio === "number"
          ? (sticky as { aspectRatio: number }).aspectRatio
          : 1;
      if (
        isInsideGeofenceSticky({
          shape,
          placeLat: sticky.lat,
          placeLng: sticky.lng,
          radiusM: sticky.radiusM,
          lat,
          lng,
          rotationDeg,
          aspectRatio,
          sticky: true,
          accuracyM,
          category: sticky.category,
        })
      ) {
        return sticky;
      }
    }
  }

  let best: PlaceRow | null = null;
  let bestDist = Infinity;
  for (const p of places) {
    if (stickyId && p.id === stickyId) continue; // already failed exit check
    const shape = asGeofenceShape(p.shape);
    const rotationDeg =
      typeof (p as { rotationDeg?: number | null }).rotationDeg === "number"
        ? (p as { rotationDeg: number }).rotationDeg
        : 0;
    const aspectRatio =
      typeof (p as { aspectRatio?: number | null }).aspectRatio === "number"
        ? (p as { aspectRatio: number }).aspectRatio
        : 1;
    if (
      !isInsideGeofence({
        shape,
        placeLat: p.lat,
        placeLng: p.lng,
        radiusM: p.radiusM,
        lat,
        lng,
        rotationDeg,
        aspectRatio,
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
      radiusM: p.radiusM,
      rotationDeg,
      aspectRatio,
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
 * Destination Prediction — driven by THIS person's trip history first.
 * Household "safe places" along the corridor must not beat a personal habit
 * (e.g. Work → Gym) just because you're closing on Home / Costco en route.
 *
 * Habits are canonicalized onto saved place names (snap street/geocode labels
 * via end coordinates + fuzzy name match) so repeated day-to-day runs actually
 * accumulate instead of fragmenting across "Howard Ave" / "Stopped" / "Gym".
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
  /** Keep a stable label when confidence dips for one GPS ping. */
  previousLabel?: string | null;
}): Promise<{
  label: string | null;
  confidence: number;
  etaMinutes: number | null;
  typicalEtaMinutes: number | null;
  reasons: string[];
}> {
  const places = await prisma.familyPlace.findMany({
    where: { householdId: opts.householdId },
  });
  if (places.length === 0) {
    return { label: null, confidence: 0, etaMinutes: null, typicalEtaMinutes: null, reasons: [] };
  }

  const placeSnaps = places.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    radiusM: p.radiusM,
  }));

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const weekday = day >= 1 && day <= 5;

  const [recent, personalVisitRows, routineHabits] = await Promise.all([
    prisma.familyTrip.findMany({
      where: { memberId: opts.memberId, isActive: false, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      take: 160,
      select: {
        fromLabel: true,
        toLabel: true,
        startedAt: true,
        distanceKm: true,
        durationMinutes: true,
        startLat: true,
        startLng: true,
        endLat: true,
        endLng: true,
      },
    }),
    prisma.familyPlaceVisit.findMany({
      where: {
        memberId: opts.memberId,
        placeId: { not: null },
        arrivedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60_000) },
      },
      select: { placeName: true, placeId: true, dwellMinutes: true },
      take: 400,
    }),
    habitualDestinationsFor({
      memberId: opts.memberId,
      dayOfWeek: day,
      hour,
      minSamples: 3,
    }).catch(() => [] as Array<{ placeName: string; sampleCount: number; score: number }>),
  ]);

  function labelsClose(a: string, b: string) {
    const x = a.trim().toLowerCase();
    const y = b.trim().toLowerCase();
    if (!x || !y) return false;
    return x === y || x.includes(y) || y.includes(x);
  }

  function canonicalizeLabel(
    label: string,
    lat: number | null | undefined,
    lng: number | null | undefined
  ): string {
    const snapped = snapLabelToPlace(label, lat, lng, placeSnaps);
    if (snapped && places.some((p) => labelsClose(p.name, snapped))) {
      const hit = places.find((p) => labelsClose(p.name, snapped));
      if (hit) return hit.name;
    }
    for (const p of places) {
      if (labelsClose(p.name, label) || labelsClose(p.name, snapped)) return p.name;
    }
    return snapped || label;
  }

  /** Habit weight for destinations this person actually drove to. */
  const habitFromOrigin = new Map<string, number>();
  const habitAny = new Map<string, number>();
  const odDurations = new Map<string, number[]>();
  const odCounts = new Map<string, number>();

  for (const trip of recent) {
    const tripHour = trip.startedAt.getHours();
    const tripDay = trip.startedAt.getDay();
    const hourDiff = Math.abs(tripHour - hour);
    const hourBonus =
      hourDiff <= 1 ? 3.2 : hourDiff <= 2 ? 2.5 : hourDiff <= 4 ? 1.2 : 0.35;
    let dayBonus = tripDay === day ? 1.8 : 0.35;
    // Weekday-to-weekday commute patterns transfer across Mon–Fri.
    if (weekday && tripDay >= 1 && tripDay <= 5 && tripDay !== day) {
      dayBonus = Math.max(dayBonus, 1.05);
    }
    const w = hourBonus + dayBonus;

    const fromCanon = canonicalizeLabel(
      trip.fromLabel,
      trip.startLat,
      trip.startLng
    );
    const toCanon = canonicalizeLabel(trip.toLabel, trip.endLat, trip.endLng);
    if (!toCanon || /^stopped$/i.test(toCanon) || /^nearby stop$/i.test(toCanon)) {
      continue;
    }

    habitAny.set(toCanon, (habitAny.get(toCanon) ?? 0) + w);
    if (
      opts.fromPlaceName &&
      (labelsClose(fromCanon, opts.fromPlaceName) ||
        labelsClose(trip.fromLabel, opts.fromPlaceName))
    ) {
      habitFromOrigin.set(
        toCanon,
        (habitFromOrigin.get(toCanon) ?? 0) + w * 2.6
      );
      const odKey = `${opts.fromPlaceName.trim().toLowerCase()}→${toCanon.trim().toLowerCase()}`;
      odCounts.set(odKey, (odCounts.get(odKey) ?? 0) + 1);
      if (
        trip.durationMinutes != null &&
        trip.durationMinutes >= 2 &&
        trip.durationMinutes <= 120
      ) {
        const list = odDurations.get(odKey) ?? [];
        list.push(trip.durationMinutes);
        odDurations.set(odKey, list);
      }
    }
  }

  const visitsByPlaceId = new Map<string, number>();
  const visitsByName = new Map<string, number>();
  for (const v of personalVisitRows) {
    if (v.placeId) {
      visitsByPlaceId.set(v.placeId, (visitsByPlaceId.get(v.placeId) ?? 0) + 1);
    }
    const key = v.placeName.trim().toLowerCase();
    if (!key) continue;
    visitsByName.set(key, (visitsByName.get(key) ?? 0) + 1);
  }

  const routineBoost = new Map<string, number>();
  for (const r of routineHabits) {
    routineBoost.set(r.placeName, Math.min(4.5, 0.55 + r.score * 0.35));
  }

  function personalHabitFor(placeName: string): number {
    let best = 0;
    for (const [label, score] of habitFromOrigin) {
      if (labelsClose(label, placeName)) best = Math.max(best, score);
    }
    for (const [label, score] of habitAny) {
      if (labelsClose(label, placeName)) best = Math.max(best, score * 0.55);
    }
    return best;
  }

  function median(nums: number[]): number | null {
    if (!nums.length) return null;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  }

  const speed = opts.speedKmh ?? null;
  const movingFast = speed != null && speed >= 14;

  type Cand = {
    name: string;
    score: number;
    distKm: number;
    etaMinutes: number | null;
    personal: boolean;
    habit: number;
    bearing: number;
  };
  const cands: Cand[] = [];

  for (const place of places) {
    if (opts.fromPlaceName && labelsClose(place.name, opts.fromPlaceName)) continue;

    const distKm = haversineKm(opts.lat, opts.lng, place.lat, place.lng);
    if (distKm < 0.05) continue;
    if (distKm > 35) continue;

    const habit = personalHabitFor(place.name);
    const visits =
      (place.id ? visitsByPlaceId.get(place.id) ?? 0 : 0) ||
      visitsByName.get(place.name.trim().toLowerCase()) ||
      0;
    // Fuzzy visit name match (GoodLife vs Gym).
    let fuzzyVisits = visits;
    if (fuzzyVisits < 2) {
      for (const [name, n] of visitsByName) {
        if (labelsClose(name, place.name)) fuzzyVisits = Math.max(fuzzyVisits, n);
      }
    }
    const routine = routineBoost.get(place.name) ?? 0;
    // Also fuzzy routine labels.
    let routineScore = routine;
    if (routineScore < 0.5) {
      for (const [name, s] of routineBoost) {
        if (labelsClose(name, place.name)) routineScore = Math.max(routineScore, s);
      }
    }

    const personal = habit >= 1.2 || fuzzyVisits >= 2 || routineScore >= 1.4;

    let score = 0;
    score += Math.min(10, habit * 1.4);
    score += Math.min(3.2, routineScore);
    if (fuzzyVisits >= 8) score += 2.0;
    else if (fuzzyVisits >= 3) score += 1.15;
    else if (fuzzyVisits >= 1) score += 0.45;

    const toBearing = bearingDeg(opts.lat, opts.lng, place.lat, place.lng);
    if (opts.headingDeg != null && Number.isFinite(opts.headingDeg)) {
      const diff = angleDiffDeg(opts.headingDeg, toBearing);
      if (diff <= 25) score += personal ? 3.4 : 1.2;
      else if (diff <= 45) score += personal ? 2.2 : 0.6;
      else if (diff <= 70) score += personal ? 0.9 : 0.15;
      else if (diff >= 120) score -= personal ? 2.2 : 3.2;
    }

    let closingKm = 0;
    if (
      opts.prevLat != null &&
      opts.prevLng != null &&
      Number.isFinite(opts.prevLat) &&
      Number.isFinite(opts.prevLng)
    ) {
      const prevDist = haversineKm(opts.prevLat, opts.prevLng, place.lat, place.lng);
      closingKm = prevDist - distKm;
      if (closingKm > 0.04) score += Math.min(personal ? 3.2 : 1.2, closingKm * (personal ? 11 : 5));
      else if (closingKm < -0.04) score -= Math.min(2.8, Math.abs(closingKm) * 10);
    }

    if (personal) {
      if (distKm < 1) score += 1.4;
      else if (distKm < 3) score += 0.9;
      else if (distKm < 8) score += 0.45;
    } else {
      if (distKm < 1) score += 0.35;
      else if (distKm < 3) score += 0.15;
    }

    // Soft day-part priors so school/work/gym runs activate before thick history.
    const cat = (place.category ?? "").toLowerCase();
    if (weekday) {
      if (cat === "school" && ((hour >= 7 && hour <= 9) || (hour >= 14 && hour <= 17))) {
        score += personal ? 1.35 : 0.85;
      }
      if (cat === "work" && ((hour >= 6 && hour <= 10) || (hour >= 15 && hour <= 19))) {
        score += personal ? 1.15 : 0.7;
      }
      if (cat === "home" && ((hour >= 15 && hour <= 22) || (hour >= 5 && hour <= 8))) {
        score += personal ? 0.9 : 0.45;
      }
    }
    if (
      isWorkoutPlace({ placeName: place.name, placeCategory: place.category }) &&
      ((hour >= 5 && hour <= 9) || (hour >= 16 && hour <= 21))
    ) {
      score += personal ? 1.2 : 0.55;
    }

    if (personal && movingFast) {
      if (cat === "home" || cat === "work") score += 0.45;
      if (isWorkoutPlace({ placeName: place.name, placeCategory: place.category })) {
        score += 0.7;
      }
    }

    // Strong same-origin OD this time-of-day → cold-start friendly.
    if (opts.fromPlaceName) {
      const odKey = `${opts.fromPlaceName.trim().toLowerCase()}→${place.name.trim().toLowerCase()}`;
      const n = odCounts.get(odKey) ?? 0;
      if (n >= 3) score += 1.8;
      else if (n >= 2) score += 1.1;
      else if (n >= 1) score += 0.55;
    }

    if (!personal) {
      score = score * 0.22 - 2.4;
    }

    const urbanKmh = Math.max(28, Math.min(75, speed && speed > 12 ? speed : 40));
    let etaMinutes = Math.max(1, Math.round((distKm / urbanKmh) * 60));
    if (opts.fromPlaceName) {
      const odKey = `${opts.fromPlaceName.trim().toLowerCase()}→${place.name.trim().toLowerCase()}`;
      const hist = median(odDurations.get(odKey) ?? []);
      if (hist != null) {
        // Blend remaining haversine ETA with typical OD duration.
        etaMinutes = Math.max(
          1,
          Math.round(hist * 0.65 + etaMinutes * 0.35)
        );
      }
    }
    if (etaMinutes > 75 && closingKm < 0.05 && !personal) continue;
    if (etaMinutes > 90 && !personal) continue;
    etaMinutes = Math.min(etaMinutes, 90);

    cands.push({
      name: place.name,
      score,
      distKm,
      etaMinutes,
      personal,
      habit,
      bearing: toBearing,
    });
  }

  // Habitual labels that aren't exact place rows (legacy / gym nicknames).
  for (const [label, h] of [...habitFromOrigin.entries(), ...habitAny.entries()]) {
    if (cands.some((c) => labelsClose(c.name, label))) continue;
    if (h < 2) continue;
    const urbanKmh = Math.max(28, Math.min(75, speed && speed > 12 ? speed : 40));
    cands.push({
      name: label,
      score: Math.min(6.5, h * 1.15),
      distKm: 6,
      etaMinutes: Math.max(3, Math.round((6 / urbanKmh) * 60)),
      personal: true,
      habit: h,
      bearing: opts.headingDeg ?? 0,
    });
  }

  // Waypoint trap: discount nearer non-personal places that sit on the bearing
  // toward a stronger personal destination (Home on the way to the gym).
  const personalBest = [...cands].filter((c) => c.personal).sort((a, b) => b.score - a.score)[0];
  if (personalBest && personalBest.habit >= 1.5) {
    for (const c of cands) {
      if (c.personal) continue;
      if (c.distKm >= personalBest.distKm * 0.85) continue;
      const bearingGap = angleDiffDeg(c.bearing, personalBest.bearing);
      if (bearingGap <= 28) {
        c.score -= 3.5;
      } else if (bearingGap <= 45) {
        c.score -= 1.8;
      }
    }
  }

  const personalPool = cands.filter((c) => c.personal && c.score >= 2.2);
  const pool = (personalPool.length > 0 ? personalPool : cands).slice();
  pool.sort((a, b) => b.score - a.score);
  const best = pool[0];
  const second = pool[1];

  // Strong OD / routine cold-start: publish personal dests a bit earlier.
  const strongOd =
    best?.personal &&
    opts.fromPlaceName &&
    (odCounts.get(
      `${opts.fromPlaceName.trim().toLowerCase()}→${best.name.trim().toLowerCase()}`
    ) ?? 0) >= 2;
  const scoreFloor = best?.personal ? (strongOd ? 2.15 : 2.4) : 4.5;
  if (!best || best.score < scoreFloor) {
    return { label: null, confidence: 0.15, etaMinutes: null, typicalEtaMinutes: null, reasons: [] };
  }

  const margin = best.score - (second?.score ?? 0);
  let confidence = 0.4 + Math.min(0.48, (best.score - 2.2) / 14);
  if (best.personal) confidence += 0.08;
  else confidence -= 0.12;
  if (best.habit >= 4) confidence += 0.1;
  else if (best.habit >= 2.5) confidence += 0.05;
  if (strongOd) confidence += 0.08;
  if (margin >= 2.5) confidence += 0.1;
  else if (margin >= 1.2) confidence += 0.05;
  else if (margin < 0.5) confidence -= 0.08;
  if (opts.headingDeg == null) confidence -= best.personal ? 0.02 : 0.06;
  confidence = Math.max(0.28, Math.min(0.96, Number(confidence.toFixed(2))));

  const prev = opts.previousLabel?.trim() || null;
  const stickyMatch =
    prev &&
    cands.find(
      (c) =>
        labelsClose(c.name, prev) &&
        c.score >= (c.personal ? 1.6 : 3.2)
    );

  const floor = best.personal ? (strongOd ? 0.34 : 0.36) : 0.45;
  function buildReasons(pick: typeof best): string[] {
    if (!pick) return [];
    const why: string[] = [];
    const odKey = opts.fromPlaceName
      ? `${opts.fromPlaceName.trim().toLowerCase()}→${pick.name.trim().toLowerCase()}`
      : null;
    const odN = odKey ? odCounts.get(odKey) ?? 0 : 0;
    const hist = odKey ? median(odDurations.get(odKey) ?? []) : null;
    if (opts.headingDeg != null && Number.isFinite(opts.headingDeg)) {
      const diff = angleDiffDeg(opts.headingDeg, pick.bearing);
      if (diff <= 45) why.push(`Same direction as usual trips to ${pick.name}`);
    }
    if (odN >= 2) why.push(`${odN} similar trips from ${opts.fromPlaceName}`);
    else if (pick.habit >= 2.5) why.push(`Frequent destination for this time of day`);
    if (hist != null) why.push(`Typically ${Math.round(hist)} min on this route`);
    if (opts.fromPlaceName) why.push(`Left ${opts.fromPlaceName}`);
    const routine = routineBoost.get(pick.name) ?? 0;
    if (routine >= 1.4) why.push(`Matches weekday routine`);
    return why.slice(0, 4);
  }

  function pack(
    pick: NonNullable<typeof best>,
    conf: number
  ): {
    label: string;
    confidence: number;
    etaMinutes: number | null;
    typicalEtaMinutes: number | null;
    reasons: string[];
  } {
    const odKey = opts.fromPlaceName
      ? `${opts.fromPlaceName.trim().toLowerCase()}→${pick.name.trim().toLowerCase()}`
      : null;
    const hist = odKey ? median(odDurations.get(odKey) ?? []) : null;
    return {
      label: pick.name,
      confidence: conf,
      etaMinutes: pick.etaMinutes,
      typicalEtaMinutes: hist != null ? Math.round(hist) : null,
      reasons: buildReasons(pick),
    };
  }

  if (confidence < floor) {
    if (
      stickyMatch &&
      (stickyMatch.personal || stickyMatch.score >= 3.5) &&
      confidence >= 0.3
    ) {
      return pack(stickyMatch, Math.max(confidence, 0.42));
    }
    return { label: null, confidence, etaMinutes: null, typicalEtaMinutes: null, reasons: [] };
  }

  if (
    stickyMatch &&
    best.personal &&
    stickyMatch.personal &&
    !labelsClose(best.name, stickyMatch.name) &&
    best.score - stickyMatch.score < 0.9 &&
    stickyMatch.score >= 2.2
  ) {
    return pack(stickyMatch, Math.max(confidence - 0.02, 0.42));
  }

  return pack(best, confidence);
}

function statusLabelFor(opts: {
  presence: string;
  placeName: string | null;
  placeCategory?: string | null;
  destination: string | null;
  etaMinutes: number | null;
  speedKmh?: number | null;
  usualWorkout?: boolean;
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
    if (
      opts.placeName &&
      isWorkoutPlace({
        placeName: opts.placeName,
        placeCategory: opts.placeCategory,
      })
    ) {
      return workoutPresenceLabel({
        placeName: opts.placeName,
        walking: true,
        usual: Boolean(opts.usualWorkout),
      });
    }
    if (opts.placeName) return `Walking near ${opts.placeName}`;
    return "Walking";
  }
  if (
    opts.placeName &&
    isWorkoutPlace({
      placeName: opts.placeName,
      placeCategory: opts.placeCategory,
    })
  ) {
    return workoutPresenceLabel({
      placeName: opts.placeName,
      walking: false,
      usual: Boolean(opts.usualWorkout),
    });
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
          householdId: opts.householdId,
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
            householdId: opts.householdId,
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

  // Live trip / prior drive context — used so walk-caps don't freeze a real drive
  // at ~7.5 km/h (which also clears destination prediction, needs speed ≥ 8).
  const activeTripEarly = await prisma.familyTrip.findFirst({
    where: { memberId: opts.memberId, isActive: true },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      distanceKm: true,
      sampleCount: true,
      startedAt: true,
      maxSpeedKmh: true,
    },
  });
  const tripLooksReal =
    activeTripEarly != null &&
    (activeTripEarly.distanceKm >= 0.25 ||
      activeTripEarly.sampleCount >= 4 ||
      (sanitizeSpeedKmh(activeTripEarly.maxSpeedKmh) ?? 0) >= 20 ||
      receiveAt.getTime() - activeTripEarly.startedAt.getTime() >= 90_000);

  // If Doppler is still flat but the pin moved ~20m+, invent pace from
  // displacement. Walk-cap short hops only for foot context — not mid-drive.
  if (speed == null || speed < 1.5) {
    const invented = inventSpeedFromDisplacement({
      movedM,
      dtSec,
      motionActivity: opts.motionActivity ?? null,
      previousPresence: (member.presenceStatus ?? "unknown") as
        | "stationary"
        | "moving"
        | "driving"
        | "unknown",
      lastSpeedKmh: member.lastSpeedKmh,
      activeTrip: Boolean(activeTripEarly),
      tripLooksReal,
    });
    if (invented != null) speed = invented;
  }

  // Reject teleports / reverse snaps — keep last good pin, refresh liveness only.
  // Driving uses a looser gate so sparse highway hops aren't frozen (Zeinab
  // Tecumseh lag/jump: reject → heartbeat → next hop looks like a teleport).
  const prevPresenceHint = (member.presenceStatus ?? "unknown") as
    | "stationary"
    | "moving"
    | "driving"
    | "unknown";
  let acceptPin = shouldAcceptPinMove({
    movedM,
    dtSec,
    accuracyM: accuracy,
    prevAccuracyM: member.lastAccuracyM ?? null,
    prevHeadingDeg: member.lastHeadingDeg ?? null,
    moveBearingDeg: moveBearing,
    sanitizedSpeedKmh: speed,
    presenceHint: prevPresenceHint,
    fixAgeMs: sampleAgeMs,
  });
  // Large hop rejected (common on iOS after gym Wi‑Fi / multipath): if the new
  // fix clearly left the sticky place or landed in Home, accept anyway so we
  // don't stay pinned at Goodlife while the person is on the couch.
  // Never override trans-continental stale-cache teleports.
  if (
    !acceptPin &&
    movedM != null &&
    movedM >= 120 &&
    movedM <= MAX_STATIONARY_CATCHUP_M &&
    member.lastLat != null &&
    member.lastLng != null
  ) {
    const stickyId = member.currentPlaceId;
    if (stickyId) {
      const stickyRow = await prisma.familyPlace.findUnique({
        where: { id: stickyId },
      });
      if (
        stickyRow &&
        isHardEscapeFromPlace({
          shape: asGeofenceShape(stickyRow.shape),
          placeLat: stickyRow.lat,
          placeLng: stickyRow.lng,
          radiusM: stickyRow.radiusM,
          lat: opts.lat,
          lng: opts.lng,
          rotationDeg:
            typeof stickyRow.rotationDeg === "number" ? stickyRow.rotationDeg : 0,
          aspectRatio:
            typeof stickyRow.aspectRatio === "number" ? stickyRow.aspectRatio : 1,
          accuracyM: accuracy,
          category: stickyRow.category,
        })
      ) {
        acceptPin = true;
      }
    }
    if (!acceptPin) {
      const landed = await findPlaceAt(opts.householdId, opts.lat, opts.lng, {
        accuracyM: accuracy,
      });
      if (
        landed &&
        (/^home$/i.test(landed.name.trim()) ||
          (landed.category ?? "").toLowerCase() === "home")
      ) {
        acceptPin = true;
      }
    }
  }
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
        householdId: opts.householdId,
      });
    }
    // Large rejected hops: do NOT stamp lastLocationAt. Heartbeats were
    // keeping the clock "fresh" at Walmart so the next home ping always
    // looked like a teleport (tiny Δt, multi-km movedM).
    const largeRejectedHop = movedM != null && movedM >= 80;
    return prisma.familyMember.update({
      where: { id: opts.memberId },
      data: {
        ...(decay ?? {}),
        ...(largeRejectedHop ? {} : { lastLocationAt: receiveAt }),
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
  // Sticky geofence + exit hysteresis — GPS edge jitter at malls/parks must not
  // detach on every hop (that caused arrive/leave spam and garbage routines).
  const placeCandidate = await findPlaceAt(opts.householdId, opts.lat, opts.lng, {
    stickyPlaceId: member.currentPlaceId,
    accuracyM: opts.accuracyM ?? null,
  });

  // Hard escape when clearly far from sticky place.
  // Do NOT force-leave on a brief "driving" blip while still near Work/Home —
  // indoor plant GPS often spikes speed and was re-firing "arrived at Work".
  let forcePlaceChange = false;
  let stickyCategory: string | null = null;
  if (
    member.currentPlaceId &&
    (placeCandidate?.id ?? null) !== member.currentPlaceId
  ) {
    const stickyRow = await prisma.familyPlace.findUnique({
      where: { id: member.currentPlaceId },
    });
    stickyCategory = stickyRow?.category ?? null;
    if (stickyRow) {
      const hardEscape = isHardEscapeFromPlace({
        shape: asGeofenceShape(stickyRow.shape),
        placeLat: stickyRow.lat,
        placeLng: stickyRow.lng,
        radiusM: stickyRow.radiusM,
        lat: opts.lat,
        lng: opts.lng,
        rotationDeg:
          typeof stickyRow.rotationDeg === "number" ? stickyRow.rotationDeg : 0,
        aspectRatio:
          typeof stickyRow.aspectRatio === "number" ? stickyRow.aspectRatio : 1,
        accuracyM: opts.accuracyM ?? null,
        category: stickyRow.category,
      });
      const cat = (stickyRow.category ?? "").toLowerCase();
      const anchorPlace = cat === "work" || cat === "home";
      const workoutSticky = isWorkoutPlace({
        placeName: stickyRow.name,
        placeCategory: stickyRow.category,
      });
      if (hardEscape) {
        forcePlaceChange = true;
        resetPlaceTransitionPending(opts.memberId);
      } else if (
        placeCandidate &&
        (/^home$/i.test(placeCandidate.name.trim()) ||
          (placeCandidate.category ?? "").toLowerCase() === "home") &&
        !anchorPlace
      ) {
        // New fix is inside Home while sticky was a shop/gym — leave now.
        forcePlaceChange = true;
        resetPlaceTransitionPending(opts.memberId);
      } else if (presence === "driving" && !anchorPlace && !workoutSticky) {
        // Don't detach park walks on phantom "driving" at the fence edge —
        // that was dropping McGuire Park mid-loop.
        forcePlaceChange = true;
        resetPlaceTransitionPending(opts.memberId);
      } else if (workoutSticky && !anchorPlace && placeCandidate != null) {
        // Outside sticky into another saved place (Home handled above).
        // "Outside everything" waits for hardEscape so trail-edge GPS doesn't
        // end the workout stay.
        forcePlaceChange = true;
        resetPlaceTransitionPending(opts.memberId);
      }
    } else {
      forcePlaceChange = true;
      resetPlaceTransitionPending(opts.memberId);
    }
  } else if (member.currentPlaceId && placeCandidate?.id === member.currentPlaceId) {
    stickyCategory = placeCandidate.category ?? null;
  }

  const confirmed = confirmPlaceTransition({
    memberId: opts.memberId,
    currentPlaceId: member.currentPlaceId,
    desiredPlaceId: placeCandidate?.id ?? null,
    forceImmediate: forcePlaceChange,
    currentPlaceCategory: stickyCategory,
  });

  let placeRaw: PlaceRow | null = null;
  if (confirmed.placeId == null) {
    placeRaw = null;
  } else if (placeCandidate && placeCandidate.id === confirmed.placeId) {
    placeRaw = placeCandidate;
  } else if (member.currentPlaceId && confirmed.placeId === member.currentPlaceId) {
    // Holding sticky current while a new fence is still confirming.
    const held = await prisma.familyPlace.findUnique({
      where: { id: member.currentPlaceId },
    });
    placeRaw = held;
  } else {
    const row = await prisma.familyPlace.findUnique({
      where: { id: confirmed.placeId },
    });
    placeRaw = row;
  }

  // Workout parks: while she's walking the loop, don't freeze as parked.
  const workoutFence =
    placeRaw != null &&
    isWorkoutPlace({ placeName: placeRaw.name, placeCategory: placeRaw.category });
  const activityWalking = opts.motionActivity === "walking";
  // Park/trail multipath invents 20–40 km/h ("Driving 32 km/h") and opens a
  // ghost trip that closes the walk stay mid-routine.
  // Never walk-cap / kill a trip that already looks like a real drive
  // (Hamoudi past a park fence stuck at 8 km/h with dead predictions).
  const vehicleThroughWorkout =
    workoutFence &&
    isClearVehicleThroughWorkout({
      speedKmh: speed,
      movedM,
      dtSec,
      motionActivity: opts.motionActivity ?? null,
      lastSpeedKmh: member.lastSpeedKmh,
      activeTrip: tripLooksReal,
    });
  if (workoutFence && !vehicleThroughWorkout && !tripLooksReal) {
    // Only foot-cap when this still looks like a trail walk — not a vehicle
    // hop through a park-named fence (disp already car-sized).
    const vehicleHop =
      movedM != null &&
      dtSec != null &&
      dtSec >= 1.5 &&
      movedM >= 35 &&
      (speed ?? 0) >= 18;
    if (vehicleHop) {
      // Keep driving presence; don't quiet-end a real pass-through.
    } else if (presence === "driving" || (speed ?? 0) >= DRIVING_START_KMH) {
      if (movedM != null && dtSec != null && dtSec >= 1 && movedM >= 8) {
        const disp = movedM / 1000 / (dtSec / 3600);
        const capped = Number.isFinite(disp)
          ? Math.min(Math.max(disp, 1.5), 7.5)
          : 5;
        speed = Math.round(capped * 10) / 10;
      } else if (
        activityWalking ||
        presence === "moving" ||
        member.presenceStatus === "moving"
      ) {
        speed = Math.min(Math.max(speed ?? 4, 1.5), 6);
      } else {
        speed = Math.min(speed ?? 0, 5);
      }
      presence = (speed ?? 0) >= 1.5 ? "moving" : "stationary";
      await quietEndActiveTrip({
        memberId: opts.memberId,
        lat: opts.lat,
        lng: opts.lng,
        at: recordedAt,
        placeName: placeRaw?.name ?? null,
        householdId: opts.householdId,
      });
    } else if (
      activityWalking &&
      (presence === "stationary" || presence === "unknown") &&
      (movedM == null || movedM >= 8)
    ) {
      presence = "moving";
      if ((speed ?? 0) < 1.5) speed = 4;
      await quietEndActiveTrip({
        memberId: opts.memberId,
        lat: opts.lat,
        lng: opts.lng,
        at: recordedAt,
        placeName: placeRaw?.name ?? null,
        householdId: opts.householdId,
      });
    } else {
      // Ghost drives opened by multipath keep the UI on "Driving" via live trip.
      await quietEndActiveTrip({
        memberId: opts.memberId,
        lat: opts.lat,
        lng: opts.lng,
        at: recordedAt,
        placeName: placeRaw?.name ?? null,
        householdId: opts.householdId,
      });
    }
  }
  const parkedAtPlace =
    placeRaw != null &&
    (speed ?? 0) < DRIVING_END_KMH &&
    (movedM == null || movedM < 35) &&
    !activityWalking &&
    !(workoutFence && (presence === "moving" || isWalkingPaceKmh(speed)));
  if (parkedAtPlace) {
    presence = "stationary";
    speed = 0;
    // Arrive + nearly still → end the drive immediately so UI doesn't keep
    // "Driving" for minutes while Life360 already shows parked (Hamoudi).
    await quietEndActiveTrip({
      memberId: opts.memberId,
      lat: opts.lat,
      lng: opts.lng,
      at: recordedAt,
      placeName: placeRaw?.name ?? null,
      householdId: opts.householdId,
    });
  }
  // Sticky confirm may still hold near the fence edge; hard-escape / driving
  // already cleared placeRaw above. Do not re-attach on motion alone.
  const place = placeRaw;
  const placeChanged = confirmed.changed;
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
          if (member.shareRoutineLearning && dwellMinutes >= 12) {
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

  const activityDriving = opts.motionActivity === "driving";
  const shouldStartTrip =
    !activeTrip &&
    !(workoutFence && !vehicleThroughWorkout) &&
    // Real travel opens a drive — require speed OR displacement pace so a
    // naked 120m multipath hop can't invent a ghost trip while parked.
    // Android often zeros Doppler on the first BG samples; Activity Recognition
    // "driving" + real pin movement must still open a trip.
    ((nextSpeed >= DRIVING_START_KMH && movedM != null && movedM >= TRIP_START_MOVE_M) ||
      (nextSpeed >= 12 && movedM != null && movedM >= 40) ||
      (nextSpeed >= 12 &&
        movedM != null &&
        movedM >= 120 &&
        dtSec != null &&
        dtSec <= 180) ||
      // Activity-only: require clearer motion so parked cars don't open ghosts.
      (activityDriving &&
        movedM != null &&
        movedM >= 55 &&
        nextSpeed >= 12));

  /** Set false when this ping ends/deletes the live trip — don't keep prediction. */
  let tripStillOpen = Boolean(activeTrip);

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
    tripStillOpen = true;
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

    const nearlyStill =
      movedM == null ||
      movedM < 22 ||
      (dtSec != null && dtSec >= 1.5 && movedM / 1000 / (dtSec / 3600) < 9);

    const shouldEnd =
      nextSpeed < DRIVING_END_KMH &&
      nearlyStill &&
      (parkedAtPlace ||
        (place != null && durationMinutes >= TRIP_END_AT_PLACE_MIN) ||
        (presence === "stationary" && durationMinutes >= 0.6) ||
        (durationMinutes >= 1.0 && (movedM == null || movedM < 18)) ||
        durationMinutes >= TRIP_END_DWELL_MIN);

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

      // Real arrival label — never invent "Home" from destination prediction.
      // Snap geocode/"Stopped" onto a nearby saved place so habits accumulate.
      let toLabel = endPlace?.name ?? null;
      if (!toLabel) {
        const near = await findPlaceAt(opts.householdId, opts.lat, opts.lng, {
          accuracyM: accuracy,
        });
        if (near) {
          toLabel = near.name;
        } else {
          const geo = await reverseGeocodeLabel(opts.lat, opts.lng);
          toLabel = geo.label || shortCoordLabel(opts.lat, opts.lng);
        }
      }

      const sameEndpoint =
        activeTrip.fromLabel.trim().toLowerCase() === toLabel.trim().toLowerCase();
      // GPS drift while parked (Home → Home / same-street loops) — drop the junk trip.
      // Do NOT delete real drives that sticky-place labeled as same endpoint
      // (e.g. Walmart → Walmart after a 3 km loop while she was already detached).
      const junkLoop =
        distanceKm < 0.25 ||
        (sameEndpoint && distanceKm < 0.55) ||
        (sameEndpoint && durationMinutes < 5 && distanceKm < 0.9);

      if (junkLoop) {
        await prisma.familyTrip.delete({ where: { id: activeTrip.id } }).catch(() => null);
        tripStillOpen = false;
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
        tripStillOpen = false;

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
  // Use tripStillOpen (not the pre-end activeTrip snapshot) so arriving
  // clears prediction the same ping the trip closes.
  // Origin for habits: mid-drive `place` is usually null after leaving the
  // fence — use the open trip's fromLabel so Work→Gym still fires.
  const liveTripOrigin =
    tripStillOpen
      ? (
          activeTrip?.fromLabel ??
          (
            await prisma.familyTrip.findFirst({
              where: { memberId: opts.memberId, isActive: true },
              select: { fromLabel: true },
            })
          )?.fromLabel ??
          null
        )
      : null;
  const prediction =
    presence === "driving" &&
    ((speed ?? 0) >= DRIVING_END_KMH || tripStillOpen)
      ? await predictDestination({
          memberId: opts.memberId,
          householdId: opts.householdId,
          fromPlaceName: place?.name ?? liveTripOrigin,
          lat: opts.lat,
          lng: opts.lng,
          headingDeg: opts.headingDeg ?? null,
          prevLat: member.lastLat,
          prevLng: member.lastLng,
          previousLabel: member.likelyDestination,
          // Floor walk-band glitches so ETA doesn't swing from a 7–11 km/h dip.
          speedKmh:
            speed != null && speed > 12
              ? speed
              : presence === "driving"
                ? Math.max(speed ?? 0, 40)
                : speed,
        })
      : {
          label: null as string | null,
          confidence: 0,
          etaMinutes: null as number | null,
          typicalEtaMinutes: null as number | null,
          reasons: [] as string[],
        };

  const statusLabel = statusLabelFor({
    presence,
    placeName: place?.name ?? null,
    placeCategory: place?.category ?? null,
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

  const drivingNow =
    presence === "driving" &&
    ((speed ?? 0) >= DRIVING_END_KMH || tripStillOpen);

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

  // Best-effort: persist Why?/typical ETA only if columns exist (additive DDL).
  // Do not put these on the Prisma model until production ALTER is verified —
  // missing columns caused P2022 storms that starved login.
  if (drivingNow && prediction.label) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "FamilyMember" SET "predictionWhy" = $1, "typicalEtaMinutes" = $2 WHERE "id" = $3`,
        prediction.reasons.length ? prediction.reasons.join(" · ") : null,
        prediction.typicalEtaMinutes,
        opts.memberId
      );
    } catch {
      // columns not present yet
    }
  } else {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "FamilyMember" SET "predictionWhy" = NULL, "typicalEtaMinutes" = NULL WHERE "id" = $1`,
        opts.memberId
      );
    } catch {
      // columns not present yet
    }
  }

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
  rotationDeg?: number;
  aspectRatio?: number;
}) {
  const rotationDeg =
    opts.rotationDeg != null && Number.isFinite(opts.rotationDeg)
      ? ((opts.rotationDeg % 360) + 360) % 360
      : 0;
  const aspectRatio =
    opts.aspectRatio != null && Number.isFinite(opts.aspectRatio) && opts.aspectRatio > 0
      ? Math.min(4, Math.max(0.25, opts.aspectRatio))
      : 1;
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
      rotationDeg,
      aspectRatio,
    },
    update: {
      lat: opts.lat,
      lng: opts.lng,
      radiusM: opts.radiusM ?? 120,
      category: opts.category ?? "other",
      ...(opts.shape ? { shape: opts.shape } : {}),
      ...(opts.rotationDeg != null ? { rotationDeg } : {}),
      ...(opts.aspectRatio != null ? { aspectRatio } : {}),
    },
  });
}

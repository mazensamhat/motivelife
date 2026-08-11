/**
 * Build drive segments from live GPS fixes on-device.
 * Records while the WebView is open and live sharing is on.
 * Background Always location writes cloud trips/stays (shown as “synced” in Today).
 */

import { haversineKm } from "@forward/shared";
import { estimateTripFuelCost } from "./vehicle-fuel";
import {
  getActiveTripDraft,
  putLocalTrip,
  setActiveTripDraft,
} from "./local-history-store";
import {
  MAX_TRIP_PATH_POINTS,
  normalizePoint,
  shouldKeepPathSample,
  thinPathInPlace,
} from "./path-compact";
import type {
  LocalHistoryFix,
  LocalHistoryPathPoint,
  LocalHistoryTrip,
  VehicleFuelHints,
} from "./local-history-types";

const MOVE_SPEED_KMH = 12;
const STOP_SPEED_KMH = 6;
const STOP_IDLE_MS = 90_000;
const MIN_TRIP_KM = 0.25;
const MIN_TRIP_MIN = 1.5;

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `loc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function labelFor(_lat: number, _lng: number, placeName?: string | null) {
  if (placeName?.trim()) return placeName.trim();
  // Never surface raw coordinates in Today / history UI.
  return "Nearby stop";
}

function scoreDrive(opts: {
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  distanceKm: number;
}): number {
  let score = 94;
  // Align with cloud Drive Score: highway 100–120 is normal, not a ding.
  if (opts.maxSpeedKmh > 130) score -= 10;
  else if (opts.maxSpeedKmh > 120) score -= 4;
  if (opts.avgSpeedKmh > 100) score -= 3;
  if (opts.distanceKm < 1) score += 2;
  return Math.max(55, Math.min(99, Math.round(score)));
}

export type IngestLocalFixInput = {
  memberId: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  recordedAt?: string;
  placeName?: string | null;
  vehicle?: VehicleFuelHints | null;
};

export type IngestLocalFixResult = {
  fix: LocalHistoryFix;
  completedTrip: LocalHistoryTrip | null;
  activeTrip: LocalHistoryTrip | null;
};

export async function ingestLocalHistoryFix(
  input: IngestLocalFixInput
): Promise<IngestLocalFixResult> {
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const fix: LocalHistoryFix = {
    id: newId(),
    memberId: input.memberId,
    lat: input.lat,
    lng: input.lng,
    speedKmh: input.speedKmh,
    headingDeg: input.headingDeg,
    accuracyM: input.accuracyM,
    recordedAt,
  };

  // Compact writes happen on putLocalTrip; age/budget prune runs via device-storage-guard.

  const speed = input.speedKmh ?? 0;
  const moving = speed >= MOVE_SPEED_KMH;
  let draft = await getActiveTripDraft(input.memberId).catch(() => null);
  let completedTrip: LocalHistoryTrip | null = null;

  if (!draft && moving) {
    const startPoint = normalizePoint({
      lat: input.lat,
      lng: input.lng,
      t: recordedAt,
      speedKmh: input.speedKmh,
    });
    draft = {
      id: newId(),
      memberId: input.memberId,
      fromLabel: labelFor(input.lat, input.lng, input.placeName),
      toLabel: "In progress",
      startLat: startPoint.lat,
      startLng: startPoint.lng,
      endLat: startPoint.lat,
      endLng: startPoint.lng,
      path: [startPoint],
      distanceKm: 0,
      durationMinutes: 0,
      avgSpeedKmh: speed,
      maxSpeedKmh: speed,
      estimatedFuelLitres: null,
      estimatedFuelKwh: null,
      estimatedFuelCostCad: null,
      driveScore: 90,
      startedAt: recordedAt,
      endedAt: recordedAt,
      lastMovingAt: recordedAt,
    };
    await setActiveTripDraft(input.memberId, draft).catch(() => undefined);
    return { fix, completedTrip: null, activeTrip: draft };
  }

  if (!draft) {
    return { fix, completedTrip: null, activeTrip: null };
  }

  const last = draft.path[draft.path.length - 1];
  if (last) {
    const segment = haversineKm(last.lat, last.lng, input.lat, input.lng);
    // Ignore GPS jumps
    if (segment < 2.5) {
      draft.distanceKm = Number((draft.distanceKm + segment).toFixed(3));
    }
  }

  const candidate: LocalHistoryPathPoint = normalizePoint({
    lat: input.lat,
    lng: input.lng,
    t: recordedAt,
    speedKmh: input.speedKmh,
  });
  // Keep endpoints dense enough for a smooth map line without storing every jitter sample.
  if (!last || shouldKeepPathSample(last, candidate)) {
    draft.path.push(candidate);
  } else if (draft.path.length > 1) {
    // Refresh the tip so the live route tracks the car — never overwrite the start point.
    draft.path[draft.path.length - 1] = candidate;
  }
  if (draft.path.length > MAX_TRIP_PATH_POINTS) {
    draft.path = thinPathInPlace(draft.path);
  }

  draft.endLat = candidate.lat;
  draft.endLng = candidate.lng;
  draft.endedAt = recordedAt;
  draft.maxSpeedKmh = Math.max(
    draft.maxSpeedKmh,
    (() => {
      const s = speed;
      return Number.isFinite(s) && s >= 0 && s <= 200 ? s : draft.maxSpeedKmh;
    })()
  );
  if (moving || speed >= STOP_SPEED_KMH) {
    draft.lastMovingAt = recordedAt;
  }
  const durationMs = new Date(recordedAt).getTime() - new Date(draft.startedAt).getTime();
  draft.durationMinutes = Number((durationMs / 60_000).toFixed(1));
  const movingSamples = draft.path.map((p) => p.speedKmh ?? 0).filter((s) => s >= STOP_SPEED_KMH);
  draft.avgSpeedKmh =
    movingSamples.length > 0
      ? Number((movingSamples.reduce((a, b) => a + b, 0) / movingSamples.length).toFixed(1))
      : 0;

  const lastMovingAt = draft.lastMovingAt ?? draft.startedAt;
  const idleMs = new Date(recordedAt).getTime() - new Date(lastMovingAt).getTime();
  const shouldEnd = !moving && idleMs >= STOP_IDLE_MS;

  if (shouldEnd) {
    const worthKeeping =
      draft.distanceKm >= MIN_TRIP_KM || draft.durationMinutes >= MIN_TRIP_MIN;
    if (worthKeeping) {
      draft.toLabel = labelFor(input.lat, input.lng, input.placeName);
      draft.driveScore = scoreDrive({
        avgSpeedKmh: draft.avgSpeedKmh,
        maxSpeedKmh: draft.maxSpeedKmh,
        distanceKm: draft.distanceKm,
      });
      if (input.vehicle?.fuelType) {
        const fuel = estimateTripFuelCost({
          distanceKm: draft.distanceKm,
          fuelType: input.vehicle.fuelType,
          litresPer100km: input.vehicle.litresPer100km,
          kwhPer100km: input.vehicle.kwhPer100km,
          fuelPriceCadPerLitre: input.vehicle.fuelPriceCadPerLitre ?? 1.55,
          evPriceCadPerKwh: input.vehicle.evPriceCadPerKwh ?? 0.14,
        });
        draft.estimatedFuelLitres = fuel.litres;
        draft.estimatedFuelKwh = fuel.kwh;
        draft.estimatedFuelCostCad = fuel.costCad;
      }
      const { lastMovingAt: _drop, ...persisted } = draft;
      completedTrip = {
        ...persisted,
        path: thinPathInPlace(persisted.path),
      };
      await putLocalTrip(completedTrip).catch(() => undefined);
    }
    await setActiveTripDraft(input.memberId, null).catch(() => undefined);
    return { fix, completedTrip, activeTrip: null };
  }

  await setActiveTripDraft(input.memberId, draft).catch(() => undefined);
  return { fix, completedTrip: null, activeTrip: draft };
}

export function filterAndSortTrips(
  trips: LocalHistoryTrip[],
  range: "day" | "month" | "year" | "all",
  sort: "newest" | "oldest" | "longest" | "costliest",
  now = new Date()
): LocalHistoryTrip[] {
  const start =
    range === "day"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : range === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : range === "year"
          ? new Date(now.getFullYear(), 0, 1)
          : new Date(0);

  let list = trips.filter((t) => new Date(t.startedAt) >= start);
  list = [...list].sort((a, b) => {
    if (sort === "oldest") {
      return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    }
    if (sort === "longest") return b.distanceKm - a.distanceKm;
    if (sort === "costliest") {
      return (b.estimatedFuelCostCad ?? 0) - (a.estimatedFuelCostCad ?? 0);
    }
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });
  return list;
}

/**
 * Compact on-device trip paths: fewer bytes, same map quality.
 * - Round coords to ~1.1 m (5 decimals) — finer than typical phone GPS
 * - Relative timestamps + optional packed storage
 * - Douglas–Peucker thinning preserves route shape better than dropping every Nth point
 */

import type { LocalHistoryPathPoint } from "./local-history-types";

/** Packed path stored in IndexedDB instead of fat `{lat,lng,t,speedKmh}[]`. */
export type CompactTripPath = {
  /** ISO start time for relative offsets. */
  t0: string;
  /**
   * Flat numbers: latE5, lngE5, dtSec, speedX10 (−1 = null), …
   * latE5 = Math.round(lat * 1e5)
   */
  v: number[];
};

const LAT_SCALE = 1e5;
/** ~8–12 m tolerance — keeps curves without keeping every GPS jitter sample. */
const DEFAULT_EPSILON_DEG = 0.00008;
export const MAX_TRIP_PATH_POINTS = 420;

export function roundCoord(n: number): number {
  return Math.round(n * LAT_SCALE) / LAT_SCALE;
}

export function roundSpeed(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

/** Drop near-duplicate samples while driving (distance + time gate). */
export function shouldKeepPathSample(
  last: LocalHistoryPathPoint | undefined,
  next: LocalHistoryPathPoint,
  opts?: { minMeters?: number; minMs?: number; alwaysKeepSpeedKmh?: number }
): boolean {
  if (!last) return true;
  const minMeters = opts?.minMeters ?? 12;
  const minMs = opts?.minMs ?? 6_000;
  const fast = opts?.alwaysKeepSpeedKmh ?? 80;
  const dt =
    new Date(next.t).getTime() - new Date(last.t).getTime();
  if (!Number.isFinite(dt) || dt < 0) return true;
  const speed = next.speedKmh ?? 0;
  if (speed >= fast) return true;
  const meters = approxMeters(last.lat, last.lng, next.lat, next.lng);
  if (meters >= minMeters) return true;
  if (dt >= minMs && meters >= 3) return true;
  return false;
}

export function thinPathInPlace(
  path: LocalHistoryPathPoint[],
  maxPoints = MAX_TRIP_PATH_POINTS
): LocalHistoryPathPoint[] {
  if (path.length <= maxPoints) {
    return path.map(normalizePoint);
  }
  const simplified = douglasPeucker(path.map(normalizePoint), DEFAULT_EPSILON_DEG);
  if (simplified.length <= maxPoints) return simplified;
  return evenlySample(simplified, maxPoints);
}

export function compactPath(points: LocalHistoryPathPoint[]): CompactTripPath {
  if (points.length === 0) {
    return { t0: new Date(0).toISOString(), v: [] };
  }
  const t0 = points[0]!.t;
  const t0Ms = new Date(t0).getTime();
  const v: number[] = [];
  for (const p of points) {
    const latE5 = Math.round(roundCoord(p.lat) * LAT_SCALE);
    const lngE5 = Math.round(roundCoord(p.lng) * LAT_SCALE);
    const dtSec = Math.max(
      0,
      Math.round((new Date(p.t).getTime() - t0Ms) / 1000)
    );
    const speedX10 =
      p.speedKmh == null || !Number.isFinite(p.speedKmh)
        ? -1
        : Math.round(p.speedKmh * 10);
    v.push(latE5, lngE5, dtSec, speedX10);
  }
  return { t0, v };
}

export function expandPath(packed: CompactTripPath | null | undefined): LocalHistoryPathPoint[] {
  if (!packed?.v?.length || !packed.t0) return [];
  const t0Ms = new Date(packed.t0).getTime();
  const out: LocalHistoryPathPoint[] = [];
  for (let i = 0; i + 3 < packed.v.length; i += 4) {
    const lat = packed.v[i]! / LAT_SCALE;
    const lng = packed.v[i + 1]! / LAT_SCALE;
    const dtSec = packed.v[i + 2]!;
    const speedX10 = packed.v[i + 3]!;
    out.push({
      lat,
      lng,
      t: new Date(t0Ms + dtSec * 1000).toISOString(),
      speedKmh: speedX10 < 0 ? null : speedX10 / 10,
    });
  }
  return out;
}

export function normalizePoint(p: LocalHistoryPathPoint): LocalHistoryPathPoint {
  return {
    lat: roundCoord(p.lat),
    lng: roundCoord(p.lng),
    t: p.t,
    speedKmh: roundSpeed(p.speedKmh),
  };
}

function approxMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111_320;
  const dLng = (lng2 - lng1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function perpendicularDistanceDeg(
  p: LocalHistoryPathPoint,
  a: LocalHistoryPathPoint,
  b: LocalHistoryPathPoint
): number {
  const x = p.lng;
  const y = p.lat;
  const x1 = a.lng;
  const y1 = a.lat;
  const x2 = b.lng;
  const y2 = b.lat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const projX = x1 + clamped * dx;
  const projY = y1 + clamped * dy;
  return Math.hypot(x - projX, y - projY);
}

function douglasPeucker(
  points: LocalHistoryPathPoint[],
  epsilon: number
): LocalHistoryPathPoint[] {
  if (points.length <= 2) return points.slice();
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistanceDeg(points[i]!, points[0]!, points[end]!);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0]!, points[end]!];
}

function evenlySample(
  points: LocalHistoryPathPoint[],
  maxPoints: number
): LocalHistoryPathPoint[] {
  if (points.length <= maxPoints) return points;
  const out: LocalHistoryPathPoint[] = [points[0]!];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(points[Math.round(i * step)]!);
  }
  out.push(points[points.length - 1]!);
  return out;
}

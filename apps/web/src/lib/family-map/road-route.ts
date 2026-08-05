/**
 * Snap sparse GPS breadcrumbs onto a real road geometry via public OSRM.
 * Used when Family history only has a few samples (or just A→B).
 */

import { haversineKm } from "@forward/shared";

export type RoadPoint = { lat: number; lng: number; t?: string; speedKmh?: number | null };

const OSRM_URL =
  process.env.OSRM_URL?.replace(/\/$/, "") ||
  "https://router.project-osrm.org";

function hasCoords(p: { lat?: number | null; lng?: number | null }) {
  return (
    p.lat != null &&
    p.lng != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0)
  );
}

/** Median consecutive segment length in metres. */
export function medianSegmentMeters(points: RoadPoint[]): number {
  if (points.length < 2) return 0;
  const segs: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    segs.push(haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000);
  }
  segs.sort((x, y) => x - y);
  return segs[Math.floor(segs.length / 2)] ?? 0;
}

/**
 * Dense local trails (many short hops) already follow the road well.
 * Sparse Android/iOS BG samples draw chords across blocks — those need OSRM.
 */
export function pathNeedsRoadSnap(points: RoadPoint[]): boolean {
  const clean = points.filter(hasCoords);
  if (clean.length < 2) return false;
  if (clean.length === 2) return true;

  const median = medianSegmentMeters(clean);
  // Long chords between samples → always snap.
  if (median >= 70) return true;
  // Short trips with medium gaps still look wrong as straight segments.
  if (clean.length <= 14 && median >= 35) return true;
  // Dense breadcrumb trail — keep raw GPS.
  if (clean.length >= 36 && median < 40) return false;

  let total = 0;
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1]!;
    const b = clean[i]!;
    total += haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
  }
  const avg = total / (clean.length - 1);
  return avg >= 55 || clean.length <= 8;
}

/** Evenly pick up to `max` waypoints from a path (keeps first + last). */
function pickWaypoints(points: RoadPoint[], max: number): RoadPoint[] {
  if (points.length <= max) return points;
  const out: RoadPoint[] = [points[0]!];
  const step = (points.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) {
    out.push(points[Math.round(i * step)]!);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * Returns a road-following polyline, or null if routing fails.
 * Safe to call from server (Node fetch) or client.
 */
export async function fetchRoadRoute(
  points: RoadPoint[],
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<RoadPoint[] | null> {
  const clean = points.filter(hasCoords);
  if (clean.length < 2) return null;

  const waypoints = pickWaypoints(clean, 25);
  const coordStr = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&continue_straight=true`;

  const timeoutMs = opts?.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  opts?.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    if (data.code !== "Ok") return null;
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;

    const startT = clean[0]!.t ?? new Date().toISOString();
    const endT = clean[clean.length - 1]!.t ?? startT;
    const startMs = Date.parse(startT);
    const endMs = Date.parse(endT);
    const span = Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : 0;

    return coords.map(([lng, lat], i) => {
      const frac = coords.length <= 1 ? 0 : i / (coords.length - 1);
      const t =
        span > 0 && Number.isFinite(startMs)
          ? new Date(startMs + span * frac).toISOString()
          : startT;
      return { lat, lng, t, speedKmh: null as number | null };
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Prefer dense GPS; if sparse (or forced), replace with a road route through the crumbs.
 * `minPointsForGpsOnly` is kept for callers but density wins when segments are long.
 */
export async function enrichPathWithRoadRoute(
  points: RoadPoint[],
  opts?: {
    minPointsForGpsOnly?: number;
    signal?: AbortSignal;
    /** When true, always attempt OSRM (A→B / local history). */
    force?: boolean;
  }
): Promise<RoadPoint[]> {
  const clean = points.filter(hasCoords);
  if (clean.length < 2) return clean;

  const needsSnap = opts?.force === true || pathNeedsRoadSnap(clean);
  if (!needsSnap) {
    const minGps = opts?.minPointsForGpsOnly ?? 10;
    if (clean.length >= minGps) return clean;
  }

  const routed = await fetchRoadRoute(clean, { signal: opts?.signal });
  if (routed && routed.length >= 2) return routed;
  return clean;
}

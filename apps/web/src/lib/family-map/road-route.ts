/**
 * Snap sparse GPS breadcrumbs onto a real road geometry via public OSRM.
 * Used when Family history only has a few samples (or just A→B).
 *
 * Critical case: dense trails with ONE long BG gap still draw a chord across
 * yards/blocks. Median-based checks miss that — we also splice OSRM into any
 * consecutive segment over LONG_CHORD_M.
 */

import { haversineKm } from "@forward/shared";

export type RoadPoint = { lat: number; lng: number; t?: string; speedKmh?: number | null };

const OSRM_URL =
  process.env.OSRM_URL?.replace(/\/$/, "") ||
  "https://router.project-osrm.org";

/** Straight GPS hop longer than this looks like an off-road chord on the map. */
export const LONG_CHORD_M = 120;

/** Don't invent a multi-km highway between two sparse samples — keep the GPS chord. */
export const MAX_SPLICE_GAP_M = 900;

function hasCoords(p: { lat?: number | null; lng?: number | null }) {
  return (
    p.lat != null &&
    p.lng != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0)
  );
}

/** Consecutive segment lengths in metres (length = points.length - 1). */
export function segmentMeters(points: RoadPoint[]): number[] {
  const clean = points.filter(hasCoords);
  const segs: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1]!;
    const b = clean[i]!;
    segs.push(haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000);
  }
  return segs;
}

/** Median consecutive segment length in metres. */
export function medianSegmentMeters(points: RoadPoint[]): number {
  const segs = segmentMeters(points);
  if (segs.length === 0) return 0;
  segs.sort((x, y) => x - y);
  return segs[Math.floor(segs.length / 2)] ?? 0;
}

export function maxSegmentMeters(points: RoadPoint[]): number {
  const segs = segmentMeters(points);
  if (segs.length === 0) return 0;
  return segs.reduce((m, s) => (s > m ? s : m), 0);
}

/** True when any consecutive hop would draw an off-road chord. */
export function pathHasLongChord(
  points: RoadPoint[],
  thresholdM = LONG_CHORD_M
): boolean {
  return maxSegmentMeters(points) >= thresholdM;
}

/**
 * Dense local trails (many short hops) already follow the road well.
 * Sparse Android/iOS BG samples draw chords across blocks — those need OSRM.
 * Also true when a mostly-dense trail still has one long BG gap.
 */
export function pathNeedsRoadSnap(points: RoadPoint[]): boolean {
  const clean = points.filter(hasCoords);
  if (clean.length < 2) return false;
  if (clean.length === 2) return true;

  // Any single long chord (parked BG batch, tunnel, deferred update) → snap.
  if (pathHasLongChord(clean)) return true;

  const median = medianSegmentMeters(clean);
  // Long chords between samples → always snap.
  if (median >= 70) return true;
  // Short trips with medium gaps still look wrong as straight segments.
  if (clean.length <= 14 && median >= 35) return true;
  // Dense breadcrumb trail with no long gaps — keep raw GPS.
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
 * Keep dense GPS crumbs; replace only the long straight gaps with road geometry.
 * Fixes “mostly fine trail + one diagonal across the block”.
 */
export async function spliceRoadIntoLongChords(
  points: RoadPoint[],
  opts?: { signal?: AbortSignal; thresholdM?: number; maxGapM?: number }
): Promise<{ path: RoadPoint[]; repaired: number }> {
  const clean = points.filter(hasCoords);
  if (clean.length < 2) return { path: clean, repaired: 0 };

  const threshold = opts?.thresholdM ?? LONG_CHORD_M;
  const maxGap = opts?.maxGapM ?? MAX_SPLICE_GAP_M;
  const segs = segmentMeters(clean);
  const longAt: number[] = [];
  for (let i = 0; i < segs.length; i++) {
    const m = segs[i] ?? 0;
    // Skip absurd gaps — OSRM /route would invent an entire corridor.
    if (m >= threshold && m <= maxGap) longAt.push(i);
  }
  if (longAt.length === 0) return { path: clean, repaired: 0 };

  // Cap OSRM calls — extreme paths still fall back to full snap upstream.
  const toFix = longAt.slice(0, 12);
  const replacements = new Map<number, RoadPoint[]>();

  await Promise.all(
    toFix.map(async (segIdx) => {
      const a = clean[segIdx]!;
      const b = clean[segIdx + 1]!;
      const routed = await fetchRoadRoute([a, b], {
        signal: opts?.signal,
        timeoutMs: 6_000,
      });
      if (routed && routed.length >= 2) {
        replacements.set(segIdx, routed);
      }
    })
  );

  if (replacements.size === 0) return { path: clean, repaired: 0 };

  const out: RoadPoint[] = [];
  for (let i = 0; i < clean.length; i++) {
    const pt = clean[i]!;
    if (i === 0) {
      out.push(pt);
      continue;
    }
    const segIdx = i - 1;
    const routed = replacements.get(segIdx);
    if (!routed?.length) {
      out.push(pt);
      continue;
    }
    // Full road polyline for this gap. Skip near-duplicate of whatever is already
    // at the tip so we don't leave a GPS→road jump + the original chord.
    const tip = out[out.length - 1]!;
    let start = 0;
    if (
      haversineKm(tip.lat, tip.lng, routed[0]!.lat, routed[0]!.lng) * 1000 < 35
    ) {
      start = 1;
    }
    for (let r = start; r < routed.length; r++) {
      out.push(routed[r]!);
    }
    // `pt` (segment end) is represented by the route's last point when close.
    const last = out[out.length - 1]!;
    if (haversineKm(last.lat, last.lng, pt.lat, pt.lng) * 1000 > 40) {
      out.push(pt);
    }
  }
  return { path: out, repaired: replacements.size };
}

/**
 * Prefer real GPS breadcrumbs for history.
 *
 * - 2 points (true A→B / empty midpoints): optional OSRM directions (`force`).
 * - 3+ points: keep GPS shape; only splice moderate consecutive gaps onto roads.
 * - Never full-path `/route` replace for multi-point trails — that invents
 *   highways/arterials the person never drove (sparse Android BG samples).
 */
export async function enrichPathWithRoadRoute(
  points: RoadPoint[],
  opts?: {
    minPointsForGpsOnly?: number;
    signal?: AbortSignal;
    /** When true and path has only 2 points, attempt A→B road directions. */
    force?: boolean;
  }
): Promise<RoadPoint[]> {
  const clean = points.filter(hasCoords);
  if (clean.length < 2) return clean;

  // True start→end only — estimated route when breadcrumbs are missing.
  if (clean.length === 2) {
    if (opts?.force !== false) {
      const routed = await fetchRoadRoute(clean, { signal: opts?.signal });
      if (routed && routed.length >= 2) return routed;
    }
    return clean;
  }

  // Multi-point trail: never rewrite the whole path with driving directions.
  const hasChord = pathHasLongChord(clean);
  if (hasChord) {
    const beforeMax = maxSegmentMeters(clean);
    const { path: spliced, repaired } = await spliceRoadIntoLongChords(clean, {
      signal: opts?.signal,
      thresholdM: LONG_CHORD_M,
      maxGapM: MAX_SPLICE_GAP_M,
    });
    const afterMax = maxSegmentMeters(spliced);
    if (repaired > 0 && afterMax <= beforeMax) {
      return spliced;
    }
  }

  // Dense or unspliceable — keep the real GPS polyline.
  return clean;
}

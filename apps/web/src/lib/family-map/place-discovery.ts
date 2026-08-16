import { haversineKm } from "@forward/shared";

/**
 * Cluster unsaved place visits into “KINZO noticed a frequent place” suggestions.
 * Pure clustering — call with a bounded visit list (map-state timeboxes the query).
 */

export type UnsavedVisitRow = {
  id: string;
  placeName: string;
  lat: number | null;
  lng: number | null;
  dwellMinutes: number | null;
  arrivedAt: Date | string;
  memberId: string;
};

export type SavedPlaceSnap = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
};

export type SuggestedPlace = {
  /** Stable id for UI keys (centroid-based). */
  id: string;
  label: string;
  lat: number;
  lng: number;
  visitCount: number;
  memberCount: number;
  /** Rough habitual window from visit hours, e.g. "usually 8 AM–4 PM" */
  usualWindowLabel: string | null;
  sampleVisitIds: string[];
};

const CLUSTER_RADIUS_M = 110;
const MIN_VISITS = 4;

function hourOf(d: Date | string): number {
  const t = typeof d === "string" ? new Date(d) : d;
  return t.getHours();
}

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr} ${period}`;
}

function nearSaved(lat: number, lng: number, places: SavedPlaceSnap[]): boolean {
  for (const p of places) {
    const r = Math.max(80, p.radiusM);
    if (haversineKm(lat, lng, p.lat, p.lng) * 1000 <= r + 40) return true;
  }
  return false;
}

/**
 * Cluster visits with null placeId (or caller already filtered) into suggestions.
 */
export function discoverFrequentPlaces(
  visits: UnsavedVisitRow[],
  savedPlaces: SavedPlaceSnap[],
  opts?: { minVisits?: number; limit?: number }
): SuggestedPlace[] {
  const minVisits = opts?.minVisits ?? MIN_VISITS;
  const limit = opts?.limit ?? 3;

  type Cluster = {
    latSum: number;
    lngSum: number;
    n: number;
    labels: Map<string, number>;
    members: Set<string>;
    hours: number[];
    visitIds: string[];
  };

  const clusters: Cluster[] = [];

  for (const v of visits) {
    if (v.lat == null || v.lng == null) continue;
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) continue;
    if (nearSaved(v.lat, v.lng, savedPlaces)) continue;

    let best: Cluster | null = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      const clat = c.latSum / c.n;
      const clng = c.lngSum / c.n;
      const d = haversineKm(v.lat, v.lng, clat, clng) * 1000;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }

    if (best && bestDist <= CLUSTER_RADIUS_M) {
      best.latSum += v.lat;
      best.lngSum += v.lng;
      best.n += 1;
      best.members.add(v.memberId);
      best.hours.push(hourOf(v.arrivedAt));
      best.visitIds.push(v.id);
      const label = v.placeName.trim() || "Frequent place";
      best.labels.set(label, (best.labels.get(label) ?? 0) + 1);
    } else {
      const label = v.placeName.trim() || "Frequent place";
      clusters.push({
        latSum: v.lat,
        lngSum: v.lng,
        n: 1,
        labels: new Map([[label, 1]]),
        members: new Set([v.memberId]),
        hours: [hourOf(v.arrivedAt)],
        visitIds: [v.id],
      });
    }
  }

  const out: SuggestedPlace[] = [];
  for (const c of clusters) {
    if (c.n < minVisits) continue;
    const lat = c.latSum / c.n;
    const lng = c.lngSum / c.n;
    let bestLabel = "Frequent place";
    let bestN = 0;
    for (const [lab, n] of c.labels) {
      if (n > bestN) {
        bestN = n;
        bestLabel = lab;
      }
    }
    // Prefer human reverse-geocode labels over raw coords.
    if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(bestLabel)) {
      bestLabel = "Frequent place";
    }

    let usualWindowLabel: string | null = null;
    if (c.hours.length >= 3) {
      const sorted = [...c.hours].sort((a, b) => a - b);
      const lo = sorted[Math.floor(sorted.length * 0.15)] ?? sorted[0]!;
      const hi = sorted[Math.floor(sorted.length * 0.85)] ?? sorted[sorted.length - 1]!;
      if (hi !== lo) {
        usualWindowLabel = `usually ${formatHour(lo)}–${formatHour(hi)}`;
      }
    }

    const id = `sug_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    out.push({
      id,
      label: bestLabel.slice(0, 60),
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      visitCount: c.n,
      memberCount: c.members.size,
      usualWindowLabel,
      sampleVisitIds: c.visitIds.slice(0, 8),
    });
  }

  out.sort((a, b) => b.visitCount - a.visitCount);
  return out.slice(0, limit);
}

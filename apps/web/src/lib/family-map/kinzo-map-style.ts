/**
 * KINZO map style specification.
 * Principle: alive, not busy — right information, right place, right time.
 */

export type KinzoMapTheme = "light" | "midnight";

/** Bubbly KINZO intelligence colors (overlays sit above the neutral basemap). */
export const KINZO_ORB = {
  weather: "#0EA5E9",
  traffic: "#EF4444",
  construction: "#F97316",
  hazard: "#EAB308",
  safety: "#22C55E",
  intelligence: "#A855F7",
  destination: "#8B5CF6",
  /** Traffic-on-road ramp for the active family route only. */
  trafficClear: "#22C55E",
  trafficSlow: "#EAB308",
  trafficHeavy: "#F97316",
  trafficJam: "#EF4444",
} as const;

export const KINZO_THEME_META: Record<
  KinzoMapTheme,
  { label: string; styleUrl: string; canvas: string }
> = {
  light: {
    label: "KINZO Light",
    styleUrl: "/map-styles/kinzo-light.json",
    canvas: "#F7F9FB",
  },
  midnight: {
    label: "KINZO Midnight",
    styleUrl: "/map-styles/kinzo-midnight.json",
    canvas: "#0B0F16",
  },
};

const THEME_STORAGE_KEY = "motivelife.kinzoMapTheme.v1";

export function readStoredKinzoTheme(): KinzoMapTheme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "midnight" || raw === "light") return raw;
  } catch {
    // private mode
  }
  return "light";
}

export function storeKinzoTheme(theme: KinzoMapTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export type LatLng = { lat: number; lng: number };

/**
 * Colour the active family route on the road itself.
 * Neutral basemap roads stay grey; only this overlay uses the traffic ramp.
 */
export function buildTrafficRouteSegments(
  path: LatLng[],
  events: Array<{
    lat: number;
    lng: number;
    kind?: string;
    severity?: string;
    distanceAheadKm?: number | null;
    etaDeltaMin?: number | null;
  }>
): Array<{ positions: [number, number][]; color: string }> {
  if (path.length < 2) return [];

  const pts = path.map((p) => [p.lat, p.lng] as [number, number]);
  if (!events.length) {
    return [{ positions: pts, color: KINZO_ORB.trafficClear }];
  }

  // Project impact events onto nearest path vertex; colour a window around them.
  const impacts: Array<{ idx: number; color: string; radius: number }> = [];
  for (const e of events) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d =
        (path[i]!.lat - e.lat) ** 2 + (path[i]!.lng - e.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    let color: string = KINZO_ORB.trafficSlow;
    if (e.kind === "traffic" || e.severity === "warning") color = KINZO_ORB.trafficJam;
    else if (e.kind === "construction") color = KINZO_ORB.construction;
    else if (e.kind === "hazard") color = KINZO_ORB.hazard;
    else if (e.kind === "weather") color = KINZO_ORB.weather;
    else if (e.severity === "watch") color = KINZO_ORB.trafficHeavy;
    const radius = Math.max(2, Math.round(path.length * 0.08));
    impacts.push({ idx: best, color, radius });
  }

  const colors: string[] = pts.map(() => KINZO_ORB.trafficClear);
  for (const hit of impacts) {
    const a = Math.max(0, hit.idx - hit.radius);
    const b = Math.min(pts.length - 1, hit.idx + hit.radius);
    for (let i = a; i <= b; i++) {
      // Worse colour wins when segments overlap.
      const rank = (c: string) =>
        c === KINZO_ORB.trafficJam
          ? 4
          : c === KINZO_ORB.construction || c === KINZO_ORB.trafficHeavy
            ? 3
            : c === KINZO_ORB.hazard || c === KINZO_ORB.trafficSlow
              ? 2
              : 1;
      if (rank(hit.color) >= rank(colors[i]!)) colors[i] = hit.color;
    }
  }

  const segments: Array<{ positions: [number, number][]; color: string }> = [];
  let start = 0;
  for (let i = 1; i <= colors.length; i++) {
    if (i === colors.length || colors[i] !== colors[start]) {
      const slice = pts.slice(start, Math.min(i + 1, pts.length));
      if (slice.length >= 2) {
        segments.push({ positions: slice, color: colors[start]! });
      }
      start = i;
    }
  }
  return segments;
}

/** Signature KINZO combined condition copy. */
export function kinzoCombinedConditionLabel(
  events: Array<{ etaDeltaMin?: number | null; kind?: string }>
): { title: string; subtitle: string; totalEta: number } {
  const n = events.length;
  const totalEta = events.reduce(
    (s, e) => s + (e.etaDeltaMin != null && e.etaDeltaMin > 0 ? e.etaDeltaMin : 0),
    0
  );
  const title =
    n <= 1
      ? "1 condition ahead"
      : `${n} conditions ahead`;
  const subtitle =
    totalEta > 0 ? `expected +${Math.round(totalEta)} min` : "tap for details";
  return { title, subtitle, totalEta };
}

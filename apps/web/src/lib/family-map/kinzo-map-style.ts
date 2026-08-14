/**
 * KINZO map style specification.
 *
 * Principle (top of the map contract):
 * The KINZO map should feel alive, not busy.
 * Show the right information, at the right place, at the right time.
 *
 * Renderer: MapLibre + vector tiles. Custom KINZO styles — not a stock theme.
 * Default daytime canvas is KINZO Light; KINZO Midnight shares the same system.
 * Neutral basemap streets; only the active family route carries strong colour.
 */

export type KinzoMapTheme = "light" | "midnight";

/**
 * KINZO Eye — information density.
 * calm: signature combined bubble only; hide quiet info orbs
 * focused: default — progressive disclosure + prefer combined when ≥2 conditions
 * vivid: show individual events with progressive disclosure
 */
export type KinzoEyeDensity = "calm" | "focused" | "vivid";

/** Quick layer filters (Traffic / Weather / Events). */
export type KinzoMapLayerFilters = {
  traffic: boolean;
  weather: boolean;
  events: boolean;
};

/** Progressive disclosure for a single condition on the map. */
export type KinzoOrbDisclosure = "dot" | "chip" | "card";

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

export const KINZO_EYE_META: Record<
  KinzoEyeDensity,
  { label: string; hint: string }
> = {
  calm: {
    label: "Calm",
    hint: "Combined conditions only",
  },
  focused: {
    label: "Focused",
    hint: "What matters on this journey",
  },
  vivid: {
    label: "Vivid",
    hint: "Individual events along the route",
  },
};

export const DEFAULT_KINZO_LAYER_FILTERS: KinzoMapLayerFilters = {
  traffic: true,
  weather: true,
  events: true,
};

const THEME_STORAGE_KEY = "motivelife.kinzoMapTheme.v1";
const EYE_STORAGE_KEY = "motivelife.kinzoEyeDensity.v1";
const LAYERS_STORAGE_KEY = "motivelife.kinzoLayerFilters.v1";

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

export function readStoredKinzoEye(): KinzoEyeDensity {
  if (typeof window === "undefined") return "focused";
  try {
    const raw = window.localStorage.getItem(EYE_STORAGE_KEY);
    if (raw === "calm" || raw === "focused" || raw === "vivid") return raw;
  } catch {
    // private mode
  }
  return "focused";
}

export function storeKinzoEye(density: KinzoEyeDensity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EYE_STORAGE_KEY, density);
  } catch {
    // ignore
  }
}

export function cycleKinzoEye(density: KinzoEyeDensity): KinzoEyeDensity {
  if (density === "calm") return "focused";
  if (density === "focused") return "vivid";
  return "calm";
}

export function readStoredKinzoLayers(): KinzoMapLayerFilters {
  if (typeof window === "undefined") return { ...DEFAULT_KINZO_LAYER_FILTERS };
  try {
    const raw = window.localStorage.getItem(LAYERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KINZO_LAYER_FILTERS };
    const parsed = JSON.parse(raw) as Partial<KinzoMapLayerFilters>;
    return {
      traffic: parsed.traffic !== false,
      weather: parsed.weather !== false,
      events: parsed.events !== false,
    };
  } catch {
    return { ...DEFAULT_KINZO_LAYER_FILTERS };
  }
}

export function storeKinzoLayers(filters: KinzoMapLayerFilters) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // ignore
  }
}

const WEATHER_KINDS = new Set(["weather", "air"]);
const TRAFFIC_KINDS = new Set(["traffic"]);
const EVENT_KINDS = new Set([
  "construction",
  "hazard",
  "accident",
  "police",
  "closure",
  "other",
]);

function eventPassesLayers(
  kind: string | undefined,
  layers: KinzoMapLayerFilters
): boolean {
  if (!kind) return layers.events;
  if (WEATHER_KINDS.has(kind)) return layers.weather;
  if (TRAFFIC_KINDS.has(kind)) return layers.traffic;
  if (EVENT_KINDS.has(kind)) return layers.events;
  return layers.events;
}

/**
 * Eye + layer gating before map markers. Does not remove traffic-on-road colour —
 * that stays on the active route separately.
 */
export function filterEventsForKinzoEye<
  T extends { kind?: string; severity?: string; etaDeltaMin?: number | null },
>(
  events: T[],
  density: KinzoEyeDensity,
  layers: KinzoMapLayerFilters = DEFAULT_KINZO_LAYER_FILTERS
): T[] {
  return events.filter((e) => {
    if (!eventPassesLayers(e.kind, layers)) return false;
    if (density === "vivid") return true;
    // Calm / focused: drop quiet “all clear” chips — they add noise, not signal.
    if (e.severity === "info" && !(e.etaDeltaMin != null && e.etaDeltaMin > 0)) {
      return false;
    }
    return true;
  });
}

/** Cluster radius — calm/focused prefer the signature combined bubble. */
export function kinzoClusterRadiusKm(density: KinzoEyeDensity): number {
  if (density === "calm") return 80;
  if (density === "focused") return 2.4;
  return 0.55;
}

/**
 * Far events = tiny dots. Relevant = icon + distance.
 * Immediate / high-impact = expanded card with impact copy.
 */
export function kinzoOrbDisclosure(event: {
  distanceAheadKm?: number | null;
  etaDeltaMin?: number | null;
  severity?: string;
}): KinzoOrbDisclosure {
  const distKm = event.distanceAheadKm ?? null;
  const eta = event.etaDeltaMin ?? 0;
  const highImpact =
    event.severity === "warning" || eta >= 5 || (distKm != null && distKm <= 0.9);
  if (highImpact) return "card";
  if (distKm != null && distKm > 3.2 && event.severity !== "warning") return "dot";
  return "chip";
}

/** Expanded card line: “Construction · 800 m · +6 min”. */
export function kinzoExpandedOrbLabel(event: {
  kind?: string;
  title?: string;
  distanceAheadKm?: number | null;
  etaDeltaMin?: number | null;
}): string {
  const kindLabel: Record<string, string> = {
    weather: "Weather",
    traffic: "Traffic",
    construction: "Construction",
    hazard: "Hazard",
    accident: "Accident",
    police: "Police",
    closure: "Closure",
    air: "Air",
    other: "Event",
  };
  const head =
    (event.kind && kindLabel[event.kind]) ||
    event.title?.split(" ")[0] ||
    "Condition";
  const parts = [head];
  if (event.distanceAheadKm != null && event.distanceAheadKm > 0) {
    const m = Math.round(event.distanceAheadKm * 1000);
    parts.push(m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
  }
  if (event.etaDeltaMin != null && event.etaDeltaMin > 0) {
    parts.push(`+${Math.round(event.etaDeltaMin)} min`);
  }
  return parts.join(" · ");
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

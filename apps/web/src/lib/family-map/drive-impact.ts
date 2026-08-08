/**
 * Build Route Orbs + Family Intelligence drive-impact from live household signals.
 * Weather = Open-Meteo. Traffic = household pace. Construction / accident / hazard /
 * closure = regional open road feeds (Ontario 511 today). Police & concert “event”
 * kinds exist in the UI language but have no live feed yet — never invent them.
 */

import type {
  DriveTripSummary,
  FamilyAirQuality,
  FamilyAreaIntel,
  FamilyDriveEvent,
  FamilyDriveEventKind,
  FamilyDriveImpact,
  FamilyMemberAirQuality,
  FamilyMemberWeather,
} from "@forward/shared";
import {
  airQualityEventTitle,
  isElevatedAirQuality,
} from "./air-quality";
import { trafficTone, weatherVisualFromCode } from "./orb-visuals";

export const DRIVE_EVENT_META: Record<
  FamilyDriveEventKind,
  { label: string; color: string; tint: string; icon: string }
> = {
  weather: {
    label: "Weather",
    color: "#38bdf8",
    tint: "rgba(56,189,248,0.45)",
    icon: "rain",
  },
  traffic: {
    label: "Traffic",
    color: "#f87171",
    tint: "rgba(248,113,113,0.4)",
    icon: "traffic",
  },
  construction: {
    label: "Construction",
    color: "#fb923c",
    tint: "rgba(251,146,60,0.42)",
    icon: "cone",
  },
  accident: {
    label: "Accident",
    color: "#c084fc",
    tint: "rgba(192,132,252,0.42)",
    icon: "crash",
  },
  hazard: {
    label: "Hazard",
    color: "#facc15",
    tint: "rgba(250,204,21,0.42)",
    icon: "hazard",
  },
  police: {
    label: "Police",
    color: "#3b82f6",
    tint: "rgba(59,130,246,0.4)",
    icon: "shield",
  },
  closure: {
    label: "Closure",
    color: "#ef4444",
    tint: "rgba(239,68,68,0.4)",
    icon: "closure",
  },
  air: {
    label: "Air quality",
    color: "#a3e635",
    tint: "rgba(163,230,53,0.42)",
    icon: "air",
  },
  other: {
    label: "Event",
    color: "#f472b6",
    tint: "rgba(244,114,182,0.4)",
    icon: "star",
  },
};

const EARTH_KM = 6371;

export function offsetAlongHeading(
  lat: number,
  lng: number,
  headingDeg: number,
  distanceKm: number
): { lat: number; lng: number } {
  const brng = (headingDeg * Math.PI) / 180;
  const d = distanceKm / EARTH_KM;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(brng)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(φ1),
      Math.cos(d) - Math.sin(φ1) * Math.sin(φ2)
    );
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const lat1 = toR(a.lat);
  const lat2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingToward(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function weatherEventTitle(w: NonNullable<FamilyAreaIntel["weather"]>): string {
  if (w.code >= 95) return "Storm ahead";
  if (w.code === 65 || w.code === 82) return "Heavy rain";
  if (w.code === 75 || w.code === 86) return "Heavy snow";
  if (w.precipMm >= 3) return "Heavy rain";
  if (w.code >= 71 && w.code < 80) return "Snow";
  if (w.code >= 61 || w.code >= 80) return "Rain ahead";
  if (w.precipMm >= 1) return "Wet roads";
  return w.summary || "Weather";
}

function isWetWeather(w: NonNullable<FamilyAreaIntel["weather"]>): boolean {
  if (w.severe) return true;
  // Light drizzle still matters on a live drive orb — phone GPS often under-reports precip.
  if (w.precipMm >= 0.4) return true;
  if (w.code >= 51 && w.code <= 67) return true;
  if (w.code >= 71 && w.code <= 86) return true;
  if (w.code >= 80 && w.code <= 82) return true;
  if (w.code >= 95) return true;
  return false;
}

/** Point along a polyline at a fraction of total length (0–1). */
export function pointAlongRoute(
  path: Array<{ lat: number; lng: number }>,
  fraction: number
): { lat: number; lng: number; distanceKm: number } | null {
  if (path.length < 2) return null;
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = haversineKm(path[i - 1]!, path[i]!);
    segs.push(d);
    total += d;
  }
  if (!(total > 0.05)) return null;
  let target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    if (target > seg && i < segs.length - 1) {
      target -= seg;
      continue;
    }
    const a = path[i]!;
    const b = path[i + 1]!;
    const t = seg > 0 ? target / seg : 0;
    return {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
      distanceKm: Number((fraction * total).toFixed(2)),
    };
  }
  const last = path[path.length - 1]!;
  return { lat: last.lat, lng: last.lng, distanceKm: Number(total.toFixed(2)) };
}

/** Snap existing events onto a live road route so orbs sit on the blue line. */
export function snapDriveEventsToRoute(
  events: FamilyDriveEvent[],
  path: Array<{ lat: number; lng: number }> | null | undefined
): FamilyDriveEvent[] {
  if (!path || path.length < 2 || events.length === 0) return events;
  const fracs = [0.22, 0.4, 0.58, 0.75];
  return events.map((e, i) => {
    const at = pointAlongRoute(path, fracs[i % fracs.length]!);
    if (!at) return e;
    return {
      ...e,
      lat: at.lat,
      lng: at.lng,
      distanceAheadKm: at.distanceKm,
    };
  });
}

function pickHeading(
  driver: {
    lat: number | null;
    lng: number | null;
    headingDeg: number | null;
    likelyDestination: string | null;
  },
  home: { lat: number; lng: number } | null
): number {
  if (driver.headingDeg != null && Number.isFinite(driver.headingDeg) && driver.headingDeg >= 0) {
    return driver.headingDeg;
  }
  if (
    home &&
    driver.lat != null &&
    driver.lng != null &&
    /home/i.test(driver.likelyDestination ?? "")
  ) {
    return bearingToward({ lat: driver.lat, lng: driver.lng }, home);
  }
  return 0;
}

function activeTripForMember(
  memberId: string,
  trips: DriveTripSummary[]
): DriveTripSummary | null {
  const open = trips.find((t) => t.memberId === memberId && !t.endedAt);
  if (open) return open;
  const recent = trips.find((t) => t.memberId === memberId);
  return recent ?? null;
}

function routeTintFor(events: FamilyDriveEvent[]): FamilyDriveImpact["routeTint"] {
  // Only adverse signals tint the route — calm “clear skies / roads clear” stay blue.
  const adverse = events.filter(
    (e) => e.severity === "watch" || e.severity === "warning"
  );
  const kinds = new Set(adverse.map((e) => e.kind));
  const hasWeather = kinds.has("weather") || kinds.has("air");
  const hasTraffic =
    kinds.has("traffic") ||
    kinds.has("construction") ||
    kinds.has("hazard") ||
    kinds.has("accident") ||
    kinds.has("closure");
  if (hasWeather && hasTraffic) return "mixed";
  if (hasWeather) return "weather";
  if (hasTraffic) return "traffic";
  return "clear";
}

function joinKindsLabel(kinds: FamilyDriveEventKind[]): string {
  const labels = kinds.map((k) => DRIVE_EVENT_META[k].label.toLowerCase());
  if (labels.length === 0) return "Conditions";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return `${labels[0]} + ${labels[1]}`;
}

/**
 * Cluster nearby events for the same driver into one map capsule.
 * Pure helper for the Leaflet layer.
 */
export function clusterDriveEvents(
  events: FamilyDriveEvent[],
  radiusKm = 0.55
): Array<
  | { type: "single"; event: FamilyDriveEvent }
  | { type: "cluster"; events: FamilyDriveEvent[]; lat: number; lng: number }
> {
  const unused = new Set(events.map((e) => e.id));
  const out: Array<
    | { type: "single"; event: FamilyDriveEvent }
    | { type: "cluster"; events: FamilyDriveEvent[]; lat: number; lng: number }
  > = [];

  for (const seed of events) {
    if (!unused.has(seed.id)) continue;
    const group = [seed];
    unused.delete(seed.id);
    for (const other of events) {
      if (!unused.has(other.id)) continue;
      if (other.memberId !== seed.memberId) continue;
      if (haversineKm(seed, other) <= radiusKm) {
        group.push(other);
        unused.delete(other.id);
      }
    }
    if (group.length === 1) {
      out.push({ type: "single", event: group[0]! });
    } else {
      const lat = group.reduce((s, e) => s + e.lat, 0) / group.length;
      const lng = group.reduce((s, e) => s + e.lng, 0) / group.length;
      out.push({ type: "cluster", events: group, lat, lng });
    }
  }
  return out;
}

export function buildDriveImpact(opts: {
  members: Array<{
    id: string;
    displayName: string;
    presence: string;
    speedKmh: number | null;
    headingDeg: number | null;
    lat: number | null;
    lng: number | null;
    etaMinutes: number | null;
    likelyDestination: string | null;
  }>;
  weather: FamilyAreaIntel["weather"];
  memberWeather: FamilyMemberWeather[];
  airQuality?: FamilyAirQuality | null;
  memberAirQuality?: FamilyMemberAirQuality[];
  traffic: FamilyAreaIntel["traffic"];
  recentTrips?: DriveTripSummary[];
  home?: { lat: number; lng: number } | null;
  /** When set, orbs snap onto this live road geometry instead of a heading ray. */
  routePath?: Array<{ lat: number; lng: number }> | null;
  /** Regional open-data road events already filtered near the household/route. */
  roadEvents?: FamilyDriveEvent[];
}): FamilyDriveImpact | null {
  const drivers = opts.members.filter(
    (m) =>
      (m.presence === "driving" ||
        m.presence === "DRIVING" ||
        ((m.presence === "moving" || m.presence === "MOVING") &&
          (m.speedKmh ?? 0) >= 20)) &&
      m.lat != null &&
      m.lng != null
  );
  if (drivers.length === 0) return null;

  const trips = opts.recentTrips ?? [];
  const events: FamilyDriveEvent[] = [];
  const weatherByMember = new Map(opts.memberWeather.map((mw) => [mw.memberId, mw]));
  const airByMember = new Map(
    (opts.memberAirQuality ?? []).map((ma) => [ma.memberId, ma])
  );
  const route = opts.routePath && opts.routePath.length >= 2 ? opts.routePath : null;

  for (const driver of drivers.slice(0, 3)) {
    const heading = pickHeading(driver, opts.home ?? null);
    const mw = weatherByMember.get(driver.id);
    const localWeather = mw?.weather ?? opts.weather;
    const localAir =
      airByMember.get(driver.id)?.airQuality ?? opts.airQuality ?? null;
    const trip = activeTripForMember(driver.id, trips);
    let slot = 0;

    const placeAhead = (distanceKm: number, routeFrac: number) => {
      slot += 1;
      if (route) {
        const at = pointAlongRoute(route, Math.min(0.85, routeFrac + (slot - 1) * 0.12));
        if (at) return { lat: at.lat, lng: at.lng, distanceAheadKm: at.distanceKm };
      }
      const dist = distanceKm + (slot - 1) * 0.35;
      return {
        ...offsetAlongHeading(driver.lat!, driver.lng!, heading, dist),
        distanceAheadKm: Number(dist.toFixed(2)),
      };
    };

    // Weather orb — animated glyph + temperature (no “Clear skies” copy on the map).
    if (localWeather) {
      const wet = isWetWeather(localWeather);
      const visual = weatherVisualFromCode(localWeather.code);
      const pos = placeAhead(wet ? (localWeather.severe ? 1.6 : 1.1) : 1.0, 0.28);
      const heavy = localWeather.severe || localWeather.precipMm >= 3;
      const etaDelta = wet ? (heavy ? 4 : localWeather.precipMm >= 1 ? 3 : 2) : 0;
      events.push({
        id: `weather-${driver.id}`,
        kind: "weather",
        title: wet ? weatherEventTitle(localWeather) : localWeather.summary,
        detail: `${localWeather.summary} · ${localWeather.tempC}°C`,
        severity: localWeather.severe ? "warning" : wet ? "watch" : "info",
        memberId: driver.id,
        memberName: driver.displayName,
        lat: pos.lat,
        lng: pos.lng,
        etaDeltaMin: etaDelta,
        distanceAheadKm: pos.distanceAheadKm,
        badge: `${localWeather.tempC}°`,
        visual,
      });
    }

    // Traffic orb — green / yellow / red pace chip (speed as badge when known).
    const slow =
      opts.traffic.level === "slow" ||
      ((driver.speedKmh ?? 0) > 5 && (driver.speedKmh ?? 0) < 32);
    const trafficSeverity: "info" | "watch" | "warning" =
      slow && (driver.speedKmh ?? 0) > 0 && (driver.speedKmh ?? 0) < 18
        ? "warning"
        : slow
          ? "watch"
          : "info";
    {
      const pos = placeAhead(slow ? 0.9 : 1.25, 0.45);
      const etaDelta =
        trafficSeverity === "warning" ? 6 : trafficSeverity === "watch" ? 4 : 0;
      const tone = trafficTone(trafficSeverity, driver.speedKmh);
      events.push({
        id: `traffic-${driver.id}`,
        kind: "traffic",
        title:
          tone === "red" ? "Slowdown" : tone === "yellow" ? "Traffic" : "Clear",
        detail:
          driver.speedKmh != null
            ? `${Math.round(driver.speedKmh)} km/h`
            : opts.traffic.summary,
        severity: trafficSeverity,
        memberId: driver.id,
        memberName: driver.displayName,
        lat: pos.lat,
        lng: pos.lng,
        etaDeltaMin: etaDelta,
        distanceAheadKm: pos.distanceAheadKm,
        badge:
          driver.speedKmh != null && driver.speedKmh > 0
            ? `${Math.round(driver.speedKmh)}`
            : tone === "green"
              ? "OK"
              : "!",
        visual: "traffic",
      });
    }

    // Air quality orb — AQI number + green / yellow / red (no long category copy).
    if (localAir) {
      const elevated = isElevatedAirQuality(localAir);
      const pos = placeAhead(elevated ? 1.35 : 1.55, 0.62);
      // Moderate stays watch so the orb can paint yellow; good stays info (green).
      const airSeverity: "info" | "watch" | "warning" =
        localAir.level === "moderate"
          ? "watch"
          : localAir.severity === "info" && elevated
            ? "watch"
            : localAir.severity;
      events.push({
        id: `air-${driver.id}`,
        kind: "air",
        title: airQualityEventTitle(localAir),
        detail: localAir.summary,
        severity: airSeverity,
        memberId: driver.id,
        memberName: driver.displayName,
        lat: pos.lat,
        lng: pos.lng,
        etaDeltaMin: 0,
        distanceAheadKm: pos.distanceAheadKm,
        badge: String(localAir.aqi),
        visual: "air",
      });
    }

    // Construction / incidents come from regional open road feeds only —
    // not from noisy phone-GPS hard-brake / unusual counters.

  }

  // Real Ontario 511 construction / incidents / closures near the drive.
  const primaryDriver = drivers[0]!;
  for (const road of opts.roadEvents ?? []) {
    if (events.some((e) => e.id === road.id)) continue;
    events.push({
      ...road,
      memberId: road.memberId ?? primaryDriver.id,
      memberName: road.memberName ?? primaryDriver.displayName,
    });
  }

  if (events.length === 0) return null;

  // Prefer the driver with the largest ETA slip for the brief headline.
  const byMember = new Map<string, FamilyDriveEvent[]>();
  for (const e of events) {
    if (!e.memberId) continue;
    const list = byMember.get(e.memberId) ?? [];
    list.push(e);
    byMember.set(e.memberId, list);
  }

  let primaryId = drivers[0]!.id;
  let bestDelta = -1;
  for (const [id, list] of byMember) {
    const delta = list.reduce((s, e) => s + (e.etaDeltaMin ?? 0), 0);
    if (delta > bestDelta) {
      bestDelta = delta;
      primaryId = id;
    }
  }

  const primary = drivers.find((d) => d.id === primaryId) ?? drivers[0]!;
  const primaryEvents = byMember.get(primary.id) ?? events;
  const etaDeltaMin = primaryEvents.reduce((s, e) => s + (e.etaDeltaMin ?? 0), 0);
  const etaMinutes = primary.etaMinutes;
  const etaWasMinutes =
    etaMinutes != null ? Math.max(1, etaMinutes - etaDeltaMin) : null;

  const adverse = primaryEvents.filter(
    (e) => e.severity === "watch" || e.severity === "warning"
  );
  const kinds = [...new Set((adverse.length ? adverse : primaryEvents).map((e) => e.kind))];
  const kindLabel = joinKindsLabel(kinds);
  const headline =
    etaDeltaMin > 0
      ? `${kindLabel.charAt(0).toUpperCase()}${kindLabel.slice(1)} on ${primary.displayName}'s drive`
      : `${primary.displayName} is on a clear run`;

  const tip = adverse[0] ?? primaryEvents[0];
  const summary =
    tip && (tip.etaDeltaMin ?? 0) > 0
      ? `${tip.title} · about +${etaDeltaMin} min vs a clear run`
      : tip
        ? tip.detail
        : opts.traffic.summary;

  return {
    primaryMemberId: primary.id,
    primaryMemberName: primary.displayName,
    headline,
    summary,
    etaMinutes,
    etaWasMinutes,
    etaDeltaMin,
    routeTint: routeTintFor(events),
    events: events.slice(0, 8),
  };
}

/** Demo impact for public preview / locked tease when we want the visual language. */
export function sampleDriveImpactForPreview(opts: {
  memberId: string;
  memberName: string;
  lat: number;
  lng: number;
  headingDeg?: number | null;
  etaMinutes?: number | null;
}): FamilyDriveImpact {
  const heading = opts.headingDeg ?? 210;
  const rain = offsetAlongHeading(opts.lat, opts.lng, heading, 1.2);
  const traffic = offsetAlongHeading(opts.lat, opts.lng, heading, 0.85);
  const cone = offsetAlongHeading(opts.lat, opts.lng, heading, 1.55);
  const crash = offsetAlongHeading(opts.lat, opts.lng, heading, 2.1);
  const events: FamilyDriveEvent[] = [
    {
      id: `preview-weather-${opts.memberId}`,
      kind: "weather",
      title: "Heavy rain",
      detail: "Rain · 12°C — leave a little earlier if you can.",
      severity: "watch",
      memberId: opts.memberId,
      memberName: opts.memberName,
      lat: rain.lat,
      lng: rain.lng,
      etaDeltaMin: 4,
      distanceAheadKm: 1.2,
      badge: "12°",
      visual: "rain",
    },
    {
      id: `preview-traffic-${opts.memberId}`,
      kind: "traffic",
      title: "Slowdown",
      detail: "Traffic slowdown · 18 km/h",
      severity: "watch",
      memberId: opts.memberId,
      memberName: opts.memberName,
      lat: traffic.lat,
      lng: traffic.lng,
      etaDeltaMin: 4,
      distanceAheadKm: 0.85,
      badge: "18",
      visual: "traffic",
    },
    {
      id: `preview-construction-${opts.memberId}`,
      kind: "construction",
      title: "Lane closed",
      detail: "Right lane closed · 500 m ahead",
      severity: "info",
      memberId: opts.memberId,
      memberName: opts.memberName,
      lat: cone.lat,
      lng: cone.lng,
      etaDeltaMin: 2,
      distanceAheadKm: 1.55,
      badge: "0.5",
      visual: "construction",
    },
    {
      id: `preview-accident-${opts.memberId}`,
      kind: "accident",
      title: "Accident",
      detail: "Right shoulder blocked · slow through the area",
      severity: "warning",
      memberId: opts.memberId,
      memberName: opts.memberName,
      lat: crash.lat,
      lng: crash.lng,
      etaDeltaMin: 5,
      distanceAheadKm: 2.1,
      badge: "2.1",
      visual: "accident",
    },
  ];
  const etaMinutes = opts.etaMinutes ?? 12;
  return {
    primaryMemberId: opts.memberId,
    primaryMemberName: opts.memberName,
    headline: `Rain + traffic on ${opts.memberName}'s drive`,
    summary: "Heavy rain and slower pace ahead — leave a little earlier if you can.",
    etaMinutes,
    etaWasMinutes: Math.max(1, etaMinutes - 6),
    etaDeltaMin: 6,
    routeTint: "mixed",
    events,
  };
}

/**
 * Build Route Orbs + Family Intelligence drive-impact from live household signals.
 * Weather = Open-Meteo at the driver. Traffic = household pace. Construction/hazard =
 * telematics proxies (unusual stops / hard brakes) — never invent police/accidents.
 */

import type {
  DriveTripSummary,
  FamilyAreaIntel,
  FamilyDriveEvent,
  FamilyDriveEventKind,
  FamilyDriveImpact,
  FamilyMemberWeather,
} from "@forward/shared";

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
  if (w.precipMm >= 1.5) return true;
  if (w.code >= 51 && w.code <= 67) return true;
  if (w.code >= 71 && w.code <= 86) return true;
  if (w.code >= 95) return true;
  return false;
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
  const kinds = new Set(events.map((e) => e.kind));
  const hasWeather = kinds.has("weather");
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
  traffic: FamilyAreaIntel["traffic"];
  recentTrips?: DriveTripSummary[];
  home?: { lat: number; lng: number } | null;
}): FamilyDriveImpact | null {
  const drivers = opts.members.filter(
    (m) =>
      (m.presence === "driving" || (m.presence === "moving" && (m.speedKmh ?? 0) >= 25)) &&
      m.lat != null &&
      m.lng != null
  );
  if (drivers.length === 0) return null;

  const trips = opts.recentTrips ?? [];
  const events: FamilyDriveEvent[] = [];
  const weatherByMember = new Map(opts.memberWeather.map((mw) => [mw.memberId, mw]));

  for (const driver of drivers.slice(0, 3)) {
    const heading = pickHeading(driver, opts.home ?? null);
    const mw = weatherByMember.get(driver.id);
    const localWeather = mw?.weather ?? opts.weather;
    const trip = activeTripForMember(driver.id, trips);
    let slot = 0;

    const placeAhead = (distanceKm: number) => {
      slot += 1;
      const dist = distanceKm + (slot - 1) * 0.35;
      return {
        ...offsetAlongHeading(driver.lat!, driver.lng!, heading, dist),
        distanceAheadKm: Number(dist.toFixed(2)),
      };
    };

    if (localWeather && isWetWeather(localWeather)) {
      const pos = placeAhead(localWeather.severe ? 1.6 : 1.1);
      const heavy = localWeather.severe || localWeather.precipMm >= 3;
      const etaDelta = heavy ? 4 : localWeather.precipMm >= 2 ? 3 : 2;
      events.push({
        id: `weather-${driver.id}`,
        kind: "weather",
        title: weatherEventTitle(localWeather),
        detail: heavy
          ? `${localWeather.summary} · ${localWeather.tempC}°C · slow carefully`
          : `${localWeather.summary} near their route`,
        severity: localWeather.severe ? "warning" : "watch",
        memberId: driver.id,
        memberName: driver.displayName,
        lat: pos.lat,
        lng: pos.lng,
        etaDeltaMin: etaDelta,
        distanceAheadKm: pos.distanceAheadKm,
      });
    }

    const slow =
      opts.traffic.level === "slow" ||
      ((driver.speedKmh ?? 0) > 5 && (driver.speedKmh ?? 0) < 28);
    if (slow) {
      const pos = placeAhead(0.9);
      const etaDelta =
        (driver.speedKmh ?? 0) > 0 && (driver.speedKmh ?? 0) < 18 ? 6 : 4;
      events.push({
        id: `traffic-${driver.id}`,
        kind: "traffic",
        title: (driver.speedKmh ?? 0) < 18 ? "Slowdown" : "Traffic ahead",
        detail:
          opts.traffic.level === "slow"
            ? opts.traffic.summary
            : `Moving ~${Math.round(driver.speedKmh ?? 0)} km/h — pace feels tight.`,
        severity: "watch",
        memberId: driver.id,
        memberName: driver.displayName,
        lat: pos.lat,
        lng: pos.lng,
        etaDeltaMin: etaDelta,
        distanceAheadKm: pos.distanceAheadKm,
      });
    }

    const unusual = trip?.unusualRouteEvents ?? 0;
    const hard = trip?.hardBraking ?? 0;
    if (unusual > 0 || (hard >= 2 && slow)) {
      const pos = placeAhead(1.4);
      events.push({
        id: `construction-${driver.id}`,
        kind: "construction",
        title: unusual > 0 ? "Road disruption" : "Road work likely",
        detail:
          unusual > 0
            ? "Unusual stop pattern on this drive — often construction or a lane issue."
            : "Several hard brakes with slow pace — road work or a tight merge is common.",
        severity: "watch",
        memberId: driver.id,
        memberName: driver.displayName,
        lat: pos.lat,
        lng: pos.lng,
        etaDeltaMin: unusual > 0 ? 3 : 2,
        distanceAheadKm: pos.distanceAheadKm,
      });
    } else if (hard >= 3) {
      const pos = placeAhead(1.2);
      events.push({
        id: `hazard-${driver.id}`,
        kind: "hazard",
        title: "Rough stretch",
        detail: "Cluster of hard brakes on this trip — something on the road may be forcing stops.",
        severity: "watch",
        memberId: driver.id,
        memberName: driver.displayName,
        lat: pos.lat,
        lng: pos.lng,
        etaDeltaMin: 2,
        distanceAheadKm: pos.distanceAheadKm,
      });
    }
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

  const kinds = [...new Set(primaryEvents.map((e) => e.kind))];
  const kindLabel = joinKindsLabel(kinds);
  const headline =
    etaDeltaMin > 0
      ? `${kindLabel.charAt(0).toUpperCase()}${kindLabel.slice(1)} on ${primary.displayName}'s drive`
      : `${primary.displayName}'s drive looks clear enough`;

  const tip = primaryEvents[0];
  const summary =
    tip && tip.etaDeltaMin
      ? `${tip.title} · about +${etaDeltaMin} min vs a clear run`
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
  const events: FamilyDriveEvent[] = [
    {
      id: `preview-weather-${opts.memberId}`,
      kind: "weather",
      title: "Heavy rain",
      detail: "Heavy Now",
      severity: "watch",
      memberId: opts.memberId,
      memberName: opts.memberName,
      lat: rain.lat,
      lng: rain.lng,
      etaDeltaMin: 4,
      distanceAheadKm: 1.2,
    },
    {
      id: `preview-traffic-${opts.memberId}`,
      kind: "traffic",
      title: "Slowdown",
      detail: "Slowdown 1.2 km",
      severity: "watch",
      memberId: opts.memberId,
      memberName: opts.memberName,
      lat: traffic.lat,
      lng: traffic.lng,
      etaDeltaMin: 4,
      distanceAheadKm: 0.85,
    },
    {
      id: `preview-construction-${opts.memberId}`,
      kind: "construction",
      title: "Lane closed",
      detail: "Right lane closed 500 m",
      severity: "info",
      memberId: opts.memberId,
      memberName: opts.memberName,
      lat: cone.lat,
      lng: cone.lng,
      etaDeltaMin: 2,
      distanceAheadKm: 1.55,
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

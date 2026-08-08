/**
 * Area intelligence for the Family Map — global weather + air quality
 * (Open-Meteo), movement-based road feel, and regional open road feeds.
 * Traffic pace is inferred from household driving speeds (not a paid crash vendor).
 */

import type {
  DriveTripSummary,
  FamilyAirQuality,
  FamilyDriveEvent,
  FamilyDriveImpact,
  FamilyMemberAirQuality,
} from "@forward/shared";
import {
  fetchAirQualityIntel,
  isElevatedAirQuality,
  type MemberAirQuality,
} from "./air-quality";
import { buildDriveImpact } from "./drive-impact";
import { fetchNearbyRoadEvents } from "./road-feeds";
import { fetchWeatherIntel } from "./weather-intel";

/** Prefer importing from `./weather-intel` in client components (keeps Prisma off the browser bundle). */
export { fetchWeatherIntel } from "./weather-intel";

export type AreaAlert = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "watch" | "warning";
  kind: "weather" | "traffic" | "emergency" | "road" | "air";
  memberId?: string | null;
  memberName?: string | null;
};

export type MemberWeather = {
  memberId: string;
  memberName: string;
  lat: number;
  lng: number;
  weather: NonNullable<FamilyAreaIntel["weather"]>;
};

export type FamilyAreaIntel = {
  weather: {
    summary: string;
    tempC: number;
    feelsLikeC: number | null;
    windKmh: number;
    precipMm: number;
    code: number;
    severe: boolean;
  } | null;
  /** Weather at each active driver's current coordinates (e.g. Toronto → Windsor). */
  memberWeather: MemberWeather[];
  /** Global air quality at household / driver focus. */
  airQuality: FamilyAirQuality | null;
  memberAirQuality: MemberAirQuality[];
  traffic: {
    level: "clear" | "slow" | "unknown";
    summary: string;
  };
  alerts: AreaAlert[];
  /** Route Orbs + ETA impact for active drives (null when quiet). */
  driveImpact: FamilyDriveImpact | null;
  /** Nearby regional open-data road events for map orbs. */
  roadEvents: FamilyDriveEvent[];
  center: { lat: number; lng: number } | null;
  updatedAt: string;
};

export function buildTrafficIntel(
  members: Array<{
    presence: string;
    speedKmh: number | null;
    displayName: string;
  }>
): FamilyAreaIntel["traffic"] {
  const drivers = members.filter(
    (m) => m.presence === "driving" && m.speedKmh != null && m.speedKmh > 5
  );
  if (drivers.length === 0) {
    return {
      level: "unknown",
      summary: "No one actively driving to judge road pace.",
    };
  }

  const avg =
    drivers.reduce((sum, d) => sum + (d.speedKmh ?? 0), 0) / drivers.length;
  const slowCount = drivers.filter((d) => (d.speedKmh ?? 0) < 28).length;

  if (slowCount >= 2 || (drivers.length === 1 && avg < 22)) {
    const names = drivers
      .filter((d) => (d.speedKmh ?? 0) < 28)
      .map((d) => d.displayName)
      .slice(0, 2)
      .join(" & ");
    return {
      level: "slow",
      summary: `Slower movement on the road (${names || "family"} ~${Math.round(avg)} km/h). Could be traffic, a hazard, or road work.`,
    };
  }

  return {
    level: "clear",
    summary: `Family drivers moving ~${Math.round(avg)} km/h — roads look workable from household movement.`,
  };
}

export function buildAreaAlerts(opts: {
  weather: FamilyAreaIntel["weather"];
  memberWeather: MemberWeather[];
  airQuality?: FamilyAirQuality | null;
  memberAirQuality?: FamilyMemberAirQuality[];
  traffic: FamilyAreaIntel["traffic"];
  lowBatteryMembers: string[];
  roadAlerts?: AreaAlert[];
  roadEvents?: FamilyDriveEvent[];
}): AreaAlert[] {
  const alerts: AreaAlert[] = [...(opts.roadAlerts ?? [])];

  for (const mw of opts.memberWeather) {
    if (mw.weather.severe) {
      alerts.push({
        id: `weather-severe-${mw.memberId}`,
        title: `Weather on ${mw.memberName}'s route`,
        body: `${mw.weather.summary} where they are now · ${mw.weather.tempC}°C · wind ${mw.weather.windKmh} km/h. Drive carefully — not an SOS.`,
        severity: mw.weather.code >= 95 ? "warning" : "watch",
        kind: "weather",
        memberId: mw.memberId,
        memberName: mw.memberName,
      });
    } else if (mw.weather.precipMm >= 2) {
      alerts.push({
        id: `weather-wet-${mw.memberId}`,
        title: `Wet roads near ${mw.memberName}`,
        body: `${mw.weather.summary} with ${mw.weather.precipMm} mm precip at their current location.`,
        severity: "info",
        kind: "weather",
        memberId: mw.memberId,
        memberName: mw.memberName,
      });
    }
  }

  // Fallback household-center weather when no drivers
  if (opts.memberWeather.length === 0 && opts.weather?.severe) {
    alerts.push({
      id: "weather-severe",
      title: "Weather attention",
      body: `${opts.weather.summary} · ${opts.weather.tempC}°C · wind ${opts.weather.windKmh} km/h. Drive carefully — not an SOS.`,
      severity: opts.weather.code >= 95 ? "warning" : "watch",
      kind: "weather",
    });
  } else if (opts.memberWeather.length === 0 && opts.weather && opts.weather.precipMm >= 2) {
    alerts.push({
      id: "weather-wet",
      title: "Wet roads",
      body: `${opts.weather.summary} with ${opts.weather.precipMm} mm precip nearby.`,
      severity: "info",
      kind: "weather",
    });
  }

  if (opts.traffic.level === "slow") {
    alerts.push({
      id: "traffic-slow",
      title: "Possible traffic or hazard",
      body: opts.traffic.summary,
      severity: "watch",
      kind: "traffic",
    });
  }

  for (const road of opts.roadEvents ?? []) {
    alerts.push({
      id: `road-${road.id}`,
      title: road.title,
      body: road.detail,
      severity: road.severity,
      kind: road.kind === "accident" || road.kind === "closure" ? "road" : "traffic",
      memberId: road.memberId,
      memberName: road.memberName,
    });
  }

  const airSamples =
    opts.memberAirQuality && opts.memberAirQuality.length > 0
      ? opts.memberAirQuality.map((m) => ({
          aq: m.airQuality,
          memberId: m.memberId,
          memberName: m.memberName,
        }))
      : opts.airQuality
        ? [{ aq: opts.airQuality, memberId: null as string | null, memberName: null as string | null }]
        : [];
  for (const sample of airSamples) {
    if (!isElevatedAirQuality(sample.aq)) continue;
    const who = sample.memberName ? ` near ${sample.memberName}` : "";
    alerts.push({
      id: `air-${sample.memberId ?? "area"}`,
      title: `Air quality${who}`,
      body: sample.aq.summary,
      severity: sample.aq.severity,
      kind: "air",
      memberId: sample.memberId,
      memberName: sample.memberName,
    });
  }

  if (opts.lowBatteryMembers.length > 0) {
    alerts.push({
      id: "battery-low",
      title: "Low battery",
      body: `${opts.lowBatteryMembers.join(", ")} under 15% — may drop off the map soon.`,
      severity: "watch",
      kind: "emergency",
    });
  }

  return alerts;
}

export async function buildFamilyAreaIntel(opts: {
  lat: number | null;
  lng: number | null;
  members: Array<{
    id?: string;
    presence: string;
    speedKmh: number | null;
    displayName: string;
    batteryPercent: number | null;
    lat?: number | null;
    lng?: number | null;
    headingDeg?: number | null;
    etaMinutes?: number | null;
    likelyDestination?: string | null;
  }>;
  recentTrips?: DriveTripSummary[];
  home?: { lat: number; lng: number } | null;
  /** Enables household police / event reports on Route Orbs. */
  householdId?: string | null;
}): Promise<FamilyAreaIntel> {
  const center =
    opts.lat != null && opts.lng != null ? { lat: opts.lat, lng: opts.lng } : null;

  let weather: FamilyAreaIntel["weather"] = null;
  let airQuality: FamilyAirQuality | null = null;
  if (center) {
    const [w, aq] = await Promise.all([
      fetchWeatherIntel(center.lat, center.lng).catch(() => null),
      fetchAirQualityIntel(center.lat, center.lng).catch(() => null),
    ]);
    weather = w;
    airQuality = aq;
  }

  // Weather + air at each driver's live coordinates (cap 4 to stay fast)
  const drivers = opts.members
    .filter(
      (m) =>
        (m.presence === "driving" || m.presence === "moving") &&
        m.lat != null &&
        m.lng != null &&
        m.id
    )
    .slice(0, 4);

  const memberWeather: MemberWeather[] = [];
  const memberAirQuality: MemberAirQuality[] = [];
  await Promise.all(
    drivers.map(async (d) => {
      if (!d.id) return;
      const [w, aq] = await Promise.all([
        fetchWeatherIntel(d.lat!, d.lng!).catch(() => null),
        fetchAirQualityIntel(d.lat!, d.lng!).catch(() => null),
      ]);
      if (w) {
        memberWeather.push({
          memberId: d.id,
          memberName: d.displayName,
          lat: d.lat!,
          lng: d.lng!,
          weather: w,
        });
      }
      if (aq) {
        memberAirQuality.push({
          memberId: d.id,
          memberName: d.displayName,
          lat: d.lat!,
          lng: d.lng!,
          airQuality: aq,
        });
      }
    })
  );

  const traffic = buildTrafficIntel(opts.members);
  const lowBatteryMembers = opts.members
    .filter((m) => m.batteryPercent != null && m.batteryPercent < 15)
    .map((m) => m.displayName);

  const driversForRoads = opts.members.filter(
    (m) =>
      m.id &&
      m.lat != null &&
      m.lng != null &&
      (m.presence === "driving" ||
        m.presence === "DRIVING" ||
        ((m.presence === "moving" || m.presence === "MOVING") &&
          (m.speedKmh ?? 0) >= 12))
  );
  const focus =
    driversForRoads[0] && driversForRoads[0].lat != null
      ? { lat: driversForRoads[0].lat!, lng: driversForRoads[0].lng! }
      : center;

  const primaryRoad = driversForRoads[0];
  const roadEvents = await fetchNearbyRoadEvents({
    center: focus,
    memberId: primaryRoad?.id ?? null,
    memberName: primaryRoad?.displayName ?? null,
    householdId: opts.householdId ?? null,
  });

  const resolvedAir = memberAirQuality[0]?.airQuality ?? airQuality;

  const driveImpact = buildDriveImpact({
    members: opts.members
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id!,
        displayName: m.displayName,
        presence: m.presence,
        speedKmh: m.speedKmh,
        headingDeg: m.headingDeg ?? null,
        lat: m.lat ?? null,
        lng: m.lng ?? null,
        etaMinutes: m.etaMinutes ?? null,
        likelyDestination: m.likelyDestination ?? null,
      })),
    weather: memberWeather[0]?.weather ?? weather,
    memberWeather,
    airQuality: resolvedAir,
    memberAirQuality,
    traffic,
    recentTrips: opts.recentTrips,
    home: opts.home ?? null,
    roadEvents,
  });

  return {
    weather: memberWeather[0]?.weather ?? weather,
    memberWeather,
    airQuality: resolvedAir,
    memberAirQuality,
    traffic,
    alerts: buildAreaAlerts({
      weather,
      memberWeather,
      airQuality: resolvedAir,
      memberAirQuality,
      traffic,
      lowBatteryMembers,
      roadEvents,
    }),
    driveImpact,
    roadEvents,
    center,
    updatedAt: new Date().toISOString(),
  };
}

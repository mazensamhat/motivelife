/**
 * Road hazard signals from telematics + severe weather at the driver's
 * current geolocation. Unusual ≠ emergency — wording stays calm.
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";

const SUDDEN_STOP_FROM_KMH = 70;
const SUDDEN_STOP_TO_KMH = 15;
const HARD_BRAKE_CLUSTER = 3;
const NOTIFY_COOLDOWN_MS = 10 * 60_000;

/** In-memory cooldown so we don't spam the household. */
const lastNotifyAt = new Map<string, number>();

export type RoadHazardSignal = {
  kind: "sudden_stop" | "hard_brake_cluster" | "severe_weather";
  title: string;
  body: string;
  severity: "watch" | "warning";
};

export function detectSuddenStopHazard(opts: {
  displayName: string;
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  hardBrakingThisTrip: number;
}): RoadHazardSignal | null {
  if (
    opts.prevSpeedKmh >= SUDDEN_STOP_FROM_KMH &&
    opts.nextSpeedKmh <= SUDDEN_STOP_TO_KMH
  ) {
    return {
      kind: "sudden_stop",
      title: "Sudden stop detected",
      body: `${opts.displayName} slowed quickly from ~${Math.round(opts.prevSpeedKmh)} km/h. Could be traffic, a hazard, or a stop — check in if it feels off.`,
      severity: "warning",
    };
  }

  if (opts.hardBrakingThisTrip >= HARD_BRAKE_CLUSTER && opts.hardBrakingThisTrip % HARD_BRAKE_CLUSTER === 0) {
    return {
      kind: "hard_brake_cluster",
      title: "Rough stretch of driving",
      body: `${opts.displayName} has several hard brakes on this trip — often traffic, weather, or road work ahead.`,
      severity: "watch",
    };
  }

  return null;
}

export async function notifyHouseholdRoadHazard(opts: {
  householdId: string;
  actorMemberId: string;
  actorDisplayName: string;
  signal: RoadHazardSignal;
}) {
  const key = `${opts.householdId}:${opts.signal.kind}:${opts.actorMemberId}`;
  const last = lastNotifyAt.get(key) ?? 0;
  if (Date.now() - last < NOTIFY_COOLDOWN_MS) return;
  lastNotifyAt.set(key, Date.now());

  const members = await prisma.familyMember.findMany({
    where: {
      householdId: opts.householdId,
      isSimulated: false,
      userId: { not: null },
    },
    select: { id: true, userId: true },
  });

  await Promise.all(
    members.map((m) => {
      if (!m.userId) return Promise.resolve(null);
      const forSelf = m.id === opts.actorMemberId;
      return createNotification({
        userId: m.userId,
        type: "family_road_alert",
        title: opts.signal.title,
        body: forSelf
          ? opts.signal.body
          : opts.signal.body,
        href: "/family-map",
      });
    })
  );
}

export function weatherHazardForDriver(opts: {
  displayName: string;
  weather: {
    summary: string;
    tempC: number;
    windKmh: number;
    precipMm: number;
    severe: boolean;
    code: number;
  } | null;
}): RoadHazardSignal | null {
  if (!opts.weather) return null;
  if (opts.weather.severe) {
    return {
      kind: "severe_weather",
      title: `Weather on ${opts.displayName}'s route`,
      body: `${opts.weather.summary} where they are now · ${opts.weather.tempC}°C · wind ${opts.weather.windKmh} km/h. Conditions can change along the drive.`,
      severity: opts.weather.code >= 95 ? "warning" : "watch",
    };
  }
  if (opts.weather.precipMm >= 3) {
    return {
      kind: "severe_weather",
      title: `Wet roads near ${opts.displayName}`,
      body: `${opts.weather.summary} with ${opts.weather.precipMm} mm precip at their current location.`,
      severity: "watch",
    };
  }
  return null;
}

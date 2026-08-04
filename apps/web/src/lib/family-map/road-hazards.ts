/**
 * Road hazard signals from telematics + severe weather at the driver's
 * current geolocation. Unusual ≠ emergency — wording stays calm.
 *
 * Tuned to resist GPS noise: denser location pings (≤1s) used to invent
 * "sudden stops" from normal deceleration / Doppler glitches.
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";

/** Highway → near-stop in a short window. */
const SUDDEN_STOP_FROM_KMH = 85;
const SUDDEN_STOP_TO_KMH = 10;
const SUDDEN_STOP_MIN_DROP_KMH = 55;
const SUDDEN_STOP_MIN_DT_SEC = 0.4;
const SUDDEN_STOP_MAX_DT_SEC = 3.5;
/** ~1.5g-class stop — normal traffic lighting is much softer. */
const SUDDEN_STOP_MIN_DECEL_KMH_S = 18;

const HARD_BRAKE_CLUSTER = 5;
/** Absolute drop alone is too noisy with 0.5–1s samples — require rate too. */
const HARD_BRAKE_MIN_DROP_KMH = 28;
const HARD_BRAKE_MIN_DECEL_KMH_S = 12;
const HARD_BRAKE_MAX_DT_SEC = 2.8;

const RAPID_ACCEL_MIN_JUMP_KMH = 30;
const RAPID_ACCEL_MIN_ACCEL_KMH_S = 12;
const RAPID_ACCEL_MAX_DT_SEC = 2.8;

const NOTIFY_COOLDOWN_MS: Record<RoadHazardSignal["kind"], number> = {
  sudden_stop: 30 * 60_000,
  hard_brake_cluster: 25 * 60_000,
  severe_weather: 45 * 60_000,
};

/** In-memory cooldown so we don't spam the household. */
const lastNotifyAt = new Map<string, number>();

export type RoadHazardSignal = {
  kind: "sudden_stop" | "hard_brake_cluster" | "severe_weather";
  title: string;
  body: string;
  severity: "watch" | "warning";
};

export function isHardBrakeEvent(opts: {
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  dtSec: number;
}): boolean {
  const drop = opts.prevSpeedKmh - opts.nextSpeedKmh;
  if (drop < HARD_BRAKE_MIN_DROP_KMH) return false;
  if (!(opts.dtSec > 0.25 && opts.dtSec <= HARD_BRAKE_MAX_DT_SEC)) return false;
  // Ignore huge gaps / teleport speed resets (e.g. stale lastKnown → live).
  if (opts.prevSpeedKmh < 35) return false;
  const decel = drop / opts.dtSec;
  return decel >= HARD_BRAKE_MIN_DECEL_KMH_S;
}

export function isRapidAccelEvent(opts: {
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  dtSec: number;
}): boolean {
  const jump = opts.nextSpeedKmh - opts.prevSpeedKmh;
  if (jump < RAPID_ACCEL_MIN_JUMP_KMH) return false;
  if (!(opts.dtSec > 0.25 && opts.dtSec <= RAPID_ACCEL_MAX_DT_SEC)) return false;
  const accel = jump / opts.dtSec;
  return accel >= RAPID_ACCEL_MIN_ACCEL_KMH_S;
}

export function detectSuddenStopHazard(opts: {
  displayName: string;
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  hardBrakingThisTrip: number;
  /** Seconds between the two GPS samples (required for rate checks). */
  dtSec?: number | null;
  accuracyM?: number | null;
}): RoadHazardSignal | null {
  const dt =
    opts.dtSec != null && Number.isFinite(opts.dtSec) ? opts.dtSec : null;
  const accuracyOk =
    opts.accuracyM == null ||
    !Number.isFinite(opts.accuracyM) ||
    opts.accuracyM <= 55;

  if (
    accuracyOk &&
    dt != null &&
    dt >= SUDDEN_STOP_MIN_DT_SEC &&
    dt <= SUDDEN_STOP_MAX_DT_SEC &&
    opts.prevSpeedKmh >= SUDDEN_STOP_FROM_KMH &&
    opts.nextSpeedKmh <= SUDDEN_STOP_TO_KMH
  ) {
    const drop = opts.prevSpeedKmh - opts.nextSpeedKmh;
    const decel = drop / dt;
    if (drop >= SUDDEN_STOP_MIN_DROP_KMH && decel >= SUDDEN_STOP_MIN_DECEL_KMH_S) {
      return {
        kind: "sudden_stop",
        title: "Sudden stop detected",
        body: `${opts.displayName} slowed quickly from ~${Math.round(opts.prevSpeedKmh)} km/h. Could be traffic, a hazard, or a stop — check in if it feels off.`,
        severity: "warning",
      };
    }
  }

  // Only one cluster heads-up after several *real* hard brakes (not every 3 GPS glitches).
  if (
    opts.hardBrakingThisTrip >= HARD_BRAKE_CLUSTER &&
    opts.hardBrakingThisTrip % HARD_BRAKE_CLUSTER === 0
  ) {
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
  const cooldown = NOTIFY_COOLDOWN_MS[opts.signal.kind] ?? 30 * 60_000;
  if (Date.now() - last < cooldown) return;
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
      return createNotification({
        userId: m.userId,
        type: "family_road_alert",
        title: opts.signal.title,
        body: opts.signal.body,
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

/**
 * Road hazard signals from telematics + severe weather at the driver's
 * current geolocation. Unusual ≠ emergency — wording stays calm.
 *
 * Tuned for fewer false counts: normal light stops, merges, and GPS
 * Doppler noise must not look like hard brakes / rapid accel.
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { wantsFamilyAlert } from "./alert-prefs";

/** Highway → near-stop in a short window. */
const SUDDEN_STOP_FROM_KMH = 90;
const SUDDEN_STOP_TO_KMH = 8;
const SUDDEN_STOP_MIN_DROP_KMH = 65;
const SUDDEN_STOP_MIN_DT_SEC = 0.45;
const SUDDEN_STOP_MAX_DT_SEC = 3.0;
/** ~0.55g-class stop — normal traffic lighting is much softer. */
const SUDDEN_STOP_MIN_DECEL_KMH_S = 20;

/** Heads-up only after a stretch of *real* hard brakes — avoid freaking people out. */
const HARD_BRAKE_CLUSTER = 8;
/**
 * Hard brake: need a large drop AND a sharp rate from road speed.
 * ~50→12 at a light over 2s is normal traffic — must not count.
 */
const HARD_BRAKE_MIN_DROP_KMH = 40;
const HARD_BRAKE_MIN_DECEL_KMH_S = 18; // ~0.5g
const HARD_BRAKE_MIN_DT_SEC = 0.4;
const HARD_BRAKE_MAX_DT_SEC = 2.0;
const HARD_BRAKE_MIN_PREV_KMH = 50;
const HARD_BRAKE_MAX_ACCURACY_M = 40;

/**
 * Rapid accel: highway merge / hard launch only — not every green light.
 * ~0→45 over 2.5s is ordinary; need a bigger, sharper jump.
 */
const RAPID_ACCEL_MIN_JUMP_KMH = 42;
const RAPID_ACCEL_MIN_ACCEL_KMH_S = 18; // ~0.5g
const RAPID_ACCEL_MIN_DT_SEC = 0.4;
const RAPID_ACCEL_MAX_DT_SEC = 2.0;
const RAPID_ACCEL_MIN_NEXT_KMH = 55;
const RAPID_ACCEL_MAX_ACCURACY_M = 40;

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

function accuracyOk(accuracyM: number | null | undefined, maxM: number): boolean {
  return (
    accuracyM == null ||
    !Number.isFinite(accuracyM) ||
    accuracyM <= maxM
  );
}

export function isHardBrakeEvent(opts: {
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  dtSec: number;
  accuracyM?: number | null;
}): boolean {
  const drop = opts.prevSpeedKmh - opts.nextSpeedKmh;
  if (drop < HARD_BRAKE_MIN_DROP_KMH) return false;
  if (
    !(opts.dtSec >= HARD_BRAKE_MIN_DT_SEC && opts.dtSec <= HARD_BRAKE_MAX_DT_SEC)
  ) {
    return false;
  }
  // Ignore low-speed / parking / neighborhood GPS jitter.
  if (opts.prevSpeedKmh < HARD_BRAKE_MIN_PREV_KMH) return false;
  if (!accuracyOk(opts.accuracyM, HARD_BRAKE_MAX_ACCURACY_M)) return false;
  const decel = drop / opts.dtSec;
  return decel >= HARD_BRAKE_MIN_DECEL_KMH_S;
}

export function isRapidAccelEvent(opts: {
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  dtSec: number;
  accuracyM?: number | null;
}): boolean {
  const jump = opts.nextSpeedKmh - opts.prevSpeedKmh;
  if (jump < RAPID_ACCEL_MIN_JUMP_KMH) return false;
  if (
    !(opts.dtSec >= RAPID_ACCEL_MIN_DT_SEC && opts.dtSec <= RAPID_ACCEL_MAX_DT_SEC)
  ) {
    return false;
  }
  // Must reach a real road speed — skips short green-light surges in town.
  if (opts.nextSpeedKmh < RAPID_ACCEL_MIN_NEXT_KMH) return false;
  if (!accuracyOk(opts.accuracyM, RAPID_ACCEL_MAX_ACCURACY_M)) return false;
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

  if (
    accuracyOk(opts.accuracyM, 40) &&
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

  let members: {
    id: string;
    userId: string | null;
    alertDriving: boolean;
    alertRoadHazards?: boolean;
  }[] = [];
  try {
    members = await prisma.familyMember.findMany({
      where: {
        householdId: opts.householdId,
        isSimulated: false,
        userId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        alertDriving: true,
        alertRoadHazards: true,
      },
    });
  } catch (error) {
    // Mid-migrate: column may not exist yet — fall back without it.
    console.warn("[road-hazards] member pref lookup failed", error);
    members = await prisma.familyMember.findMany({
      where: {
        householdId: opts.householdId,
        isSimulated: false,
        userId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        alertDriving: true,
      },
    });
  }

  await Promise.all(
    members.map((m) => {
      if (!m.userId) return Promise.resolve(null);
      if (m.id === opts.actorMemberId) return Promise.resolve(null);
      if (!wantsFamilyAlert(m, "road_hazards")) return Promise.resolve(null);
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

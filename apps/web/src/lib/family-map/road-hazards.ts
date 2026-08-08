/**
 * Road hazard signals from telematics + severe weather at the driver's
 * current geolocation. Unusual ≠ emergency — wording stays calm.
 *
 * Tuned hard against phone-GPS false positives: normal light stops, merges,
 * Doppler lag, and missing accuracy must not count as hard brakes / launches.
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { wantsFamilyAlert } from "./alert-prefs";

/** Highway → near-stop in a short window. */
const SUDDEN_STOP_FROM_KMH = 100;
const SUDDEN_STOP_TO_KMH = 6;
const SUDDEN_STOP_MIN_DROP_KMH = 75;
const SUDDEN_STOP_MIN_DT_SEC = 0.6;
const SUDDEN_STOP_MAX_DT_SEC = 2.5;
/** ~0.75g-class panic stop — not a normal freeway taper. */
const SUDDEN_STOP_MIN_DECEL_KMH_S = 28;

/** Heads-up only after a stretch of *real* hard brakes — avoid freaking people out. */
const HARD_BRAKE_CLUSTER = 10;
/**
 * Hard brake: phone GPS makes ordinary 60→15 light stops look "hard".
 * Require arterial/highway pace, a huge drop, sharp rate, and a near-stop finish.
 */
const HARD_BRAKE_MIN_DROP_KMH = 55;
const HARD_BRAKE_MIN_DECEL_KMH_S = 26; // ~0.74g
const HARD_BRAKE_MIN_DT_SEC = 0.6;
const HARD_BRAKE_MAX_DT_SEC = 1.8;
const HARD_BRAKE_MIN_PREV_KMH = 70;
const HARD_BRAKE_MAX_NEXT_KMH = 22;
const HARD_BRAKE_MAX_ACCURACY_M = 25;

/**
 * Rapid accel: real launch / aggressive merge only.
 * Ordinary green-light roll-ons (0→50 over a couple seconds) must not count.
 */
const RAPID_ACCEL_MIN_JUMP_KMH = 55;
const RAPID_ACCEL_MIN_ACCEL_KMH_S = 26; // ~0.74g
const RAPID_ACCEL_MIN_DT_SEC = 0.6;
const RAPID_ACCEL_MAX_DT_SEC = 1.8;
const RAPID_ACCEL_MAX_PREV_KMH = 25;
const RAPID_ACCEL_MIN_NEXT_KMH = 70;
const RAPID_ACCEL_MAX_ACCURACY_M = 25;

/** Don't stack the same event every GPS tick during one stop/launch. */
const EVENT_COOLDOWN_MS = 12_000;

const NOTIFY_COOLDOWN_MS: Record<RoadHazardSignal["kind"], number> = {
  sudden_stop: 45 * 60_000,
  hard_brake_cluster: 40 * 60_000,
  severe_weather: 45 * 60_000,
};

/** In-memory cooldown so we don't spam the household. */
const lastNotifyAt = new Map<string, number>();
/** Per-member cooldown for counting hard brake / rapid accel on a trip. */
const lastDriveEventAt = new Map<string, number>();

export type RoadHazardSignal = {
  kind: "sudden_stop" | "hard_brake_cluster" | "severe_weather";
  title: string;
  body: string;
  severity: "watch" | "warning";
};

/** Unknown accuracy → do not count (phone GPS without HDOP is too noisy). */
function accuracyOk(accuracyM: number | null | undefined, maxM: number): boolean {
  return (
    accuracyM != null &&
    Number.isFinite(accuracyM) &&
    accuracyM > 0 &&
    accuracyM <= maxM
  );
}

/**
 * Reject speed jumps that disagree with how far the pin actually moved.
 * Classic false hard-brake: Doppler drops to 10 while the car still covered
 * ~35 m in 1 s (~126 km/h of ground speed). A real 95→8 stop still covers ~14 m.
 */
function speedChangeMatchesMotion(opts: {
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  dtSec: number;
  movedM?: number | null;
  mode: "brake" | "accel";
}): boolean {
  if (opts.movedM == null || !Number.isFinite(opts.movedM) || opts.dtSec < 0.4) {
    // No displacement sample — allow only if the claimed change is extreme.
    return opts.mode === "brake"
      ? opts.prevSpeedKmh - opts.nextSpeedKmh >= 65
      : opts.nextSpeedKmh - opts.prevSpeedKmh >= 65;
  }
  const dispKmh = opts.movedM / 1000 / (opts.dtSec / 3600);
  if (!Number.isFinite(dispKmh)) return false;

  const expectedM =
    ((opts.prevSpeedKmh + opts.nextSpeedKmh) / 2 / 3.6) * opts.dtSec;

  if (opts.mode === "brake") {
    // Covering much more ground than a constant-decel stop allows → Doppler lie.
    if (
      expectedM > 0 &&
      opts.movedM > Math.max(expectedM * 1.75, expectedM + 12)
    ) {
      return false;
    }
    // Barely moved while claiming we were at 80+ — only trust a near-stop finish.
    if (opts.movedM < 3 && opts.prevSpeedKmh >= 70) {
      return opts.nextSpeedKmh <= 12;
    }
    return true;
  }

  // Accel: ground speed should have picked up — not a Doppler spike in place.
  if (opts.movedM < 8 && opts.nextSpeedKmh >= 70) return false;
  if (expectedM > 0 && opts.movedM < expectedM * 0.35) return false;
  return true;
}

function eventCooldownOk(memberKey: string, kind: "hard_brake" | "rapid_accel"): boolean {
  const key = `${memberKey}:${kind}`;
  const last = lastDriveEventAt.get(key) ?? 0;
  if (Date.now() - last < EVENT_COOLDOWN_MS) return false;
  lastDriveEventAt.set(key, Date.now());
  return true;
}

export function isHardBrakeEvent(opts: {
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  dtSec: number;
  accuracyM?: number | null;
  movedM?: number | null;
  /** When set, enforces per-driver cooldown so one stop isn't counted 4×. */
  memberKey?: string | null;
}): boolean {
  const drop = opts.prevSpeedKmh - opts.nextSpeedKmh;
  if (drop < HARD_BRAKE_MIN_DROP_KMH) return false;
  if (
    !(opts.dtSec >= HARD_BRAKE_MIN_DT_SEC && opts.dtSec <= HARD_BRAKE_MAX_DT_SEC)
  ) {
    return false;
  }
  if (opts.prevSpeedKmh < HARD_BRAKE_MIN_PREV_KMH) return false;
  if (opts.nextSpeedKmh > HARD_BRAKE_MAX_NEXT_KMH) return false;
  if (!accuracyOk(opts.accuracyM, HARD_BRAKE_MAX_ACCURACY_M)) return false;
  const decel = drop / opts.dtSec;
  if (decel < HARD_BRAKE_MIN_DECEL_KMH_S) return false;
  if (
    !speedChangeMatchesMotion({
      prevSpeedKmh: opts.prevSpeedKmh,
      nextSpeedKmh: opts.nextSpeedKmh,
      dtSec: opts.dtSec,
      movedM: opts.movedM,
      mode: "brake",
    })
  ) {
    return false;
  }
  if (opts.memberKey && !eventCooldownOk(opts.memberKey, "hard_brake")) return false;
  return true;
}

export function isRapidAccelEvent(opts: {
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  dtSec: number;
  accuracyM?: number | null;
  movedM?: number | null;
  memberKey?: string | null;
}): boolean {
  const jump = opts.nextSpeedKmh - opts.prevSpeedKmh;
  if (jump < RAPID_ACCEL_MIN_JUMP_KMH) return false;
  if (
    !(opts.dtSec >= RAPID_ACCEL_MIN_DT_SEC && opts.dtSec <= RAPID_ACCEL_MAX_DT_SEC)
  ) {
    return false;
  }
  // Start from a crawl / stop — mid-road merges need an even sharper jump (handled by rate).
  if (opts.prevSpeedKmh > RAPID_ACCEL_MAX_PREV_KMH) return false;
  if (opts.nextSpeedKmh < RAPID_ACCEL_MIN_NEXT_KMH) return false;
  if (!accuracyOk(opts.accuracyM, RAPID_ACCEL_MAX_ACCURACY_M)) return false;
  const accel = jump / opts.dtSec;
  if (accel < RAPID_ACCEL_MIN_ACCEL_KMH_S) return false;
  if (
    !speedChangeMatchesMotion({
      prevSpeedKmh: opts.prevSpeedKmh,
      nextSpeedKmh: opts.nextSpeedKmh,
      dtSec: opts.dtSec,
      movedM: opts.movedM,
      mode: "accel",
    })
  ) {
    return false;
  }
  if (opts.memberKey && !eventCooldownOk(opts.memberKey, "rapid_accel")) return false;
  return true;
}

export function detectSuddenStopHazard(opts: {
  displayName: string;
  prevSpeedKmh: number;
  nextSpeedKmh: number;
  hardBrakingThisTrip: number;
  /** Seconds between the two GPS samples (required for rate checks). */
  dtSec?: number | null;
  accuracyM?: number | null;
  movedM?: number | null;
}): RoadHazardSignal | null {
  const dt =
    opts.dtSec != null && Number.isFinite(opts.dtSec) ? opts.dtSec : null;

  if (
    accuracyOk(opts.accuracyM, 25) &&
    dt != null &&
    dt >= SUDDEN_STOP_MIN_DT_SEC &&
    dt <= SUDDEN_STOP_MAX_DT_SEC &&
    opts.prevSpeedKmh >= SUDDEN_STOP_FROM_KMH &&
    opts.nextSpeedKmh <= SUDDEN_STOP_TO_KMH
  ) {
    const drop = opts.prevSpeedKmh - opts.nextSpeedKmh;
    const decel = drop / dt;
    if (
      drop >= SUDDEN_STOP_MIN_DROP_KMH &&
      decel >= SUDDEN_STOP_MIN_DECEL_KMH_S &&
      speedChangeMatchesMotion({
        prevSpeedKmh: opts.prevSpeedKmh,
        nextSpeedKmh: opts.nextSpeedKmh,
        dtSec: dt,
        movedM: opts.movedM,
        mode: "brake",
      })
    ) {
      return {
        kind: "sudden_stop",
        title: "Sudden stop detected",
        body: `${opts.displayName} slowed quickly from ~${Math.round(opts.prevSpeedKmh)} km/h. Could be traffic, a hazard, or a stop — check in if it feels off.`,
        severity: "warning",
      };
    }
  }

  // Only one cluster heads-up after several *real* hard brakes (not every GPS glitch).
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
  // Heavier precip only — light rain was flooding inbox tips.
  if (opts.weather.precipMm >= 6) {
    return {
      kind: "severe_weather",
      title: `Wet roads near ${opts.displayName}`,
      body: `${opts.weather.summary} with ${opts.weather.precipMm} mm precip at their current location.`,
      severity: "watch",
    };
  }
  return null;
}

/** Test helper — clears in-memory cooldowns between unit checks. */
export function __resetDriveEventCooldownsForTests() {
  lastDriveEventAt.clear();
  lastNotifyAt.clear();
}

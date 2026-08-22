/**
 * GPS quality gates for Family Map pins.
 * Goal: fewer false “Driving 40 km/h” over a house, and no snap-back /
 * snap-forward teleports that make it look like we lost the person.
 *
 * While driving, prefer accepting highway hops over freezing the pin —
 * an 8s gap at 100 km/h is ~220 m and must not get stuck as a “teleport”.
 */
import { sanitizeSpeedKmh } from "@forward/shared";

/** Max single-hop catch-up while stationary / slow — blocks trans-continental replays. */
export const MAX_STATIONARY_CATCHUP_M = 50_000;

/** Absolute ceiling for any catch-up hop (even mid-drive). */
export const MAX_CATCHUP_JUMP_M = 150_000;

/** When comparing hops, never floor Δt beyond this (stops 7k km → "170 km/h"). */
export const MAX_HOP_DT_FLOOR_SEC = 6 * 3600;

export function displacementKmh(movedM: number, dtSec: number): number {
  if (!(dtSec > 0) || !(movedM >= 0)) return 0;
  return movedM / 1000 / (dtSec / 3600);
}

export function angleDeltaDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Kill leftover Doppler / multipath speeds that aren't backed by real movement.
 */
export function sanitizeMotionSpeed(opts: {
  speedKmh: number | null | undefined;
  movedM: number | null;
  dtSec: number | null;
  accuracyM: number | null;
}): number | null {
  let speed = sanitizeSpeedKmh(opts.speedKmh);
  if (speed == null) return null;

  const { movedM, dtSec, accuracyM } = opts;

  // Poor accuracy + “driving” Doppler is usually indoor multipath.
  if (accuracyM != null) {
    if (accuracyM > 80 && speed < 40) speed = 0;
    if (accuracyM > 55 && speed < 20) speed = 0;
  }

  // Cold start / first sample after login — no prior pin to corroborate.
  // Never trust Doppler alone here: wake/last-known often carries a leftover
  // highway speed (e.g. 95 km/h) while the person is sitting on the couch.
  if (movedM == null) {
    return 0;
  }

  // Walking band: still-floor high enough that couch/park jitter ≠ Walking.
  // Driving band: harder — 42 km/h over a backyard must not stick.
  if (speed > 0 && speed < 8) {
    const stillFloorM = Math.max(12, (accuracyM ?? 40) * 0.35);
    if (movedM < stillFloorM) return 0;
  }

  if (speed >= 8 && speed < 12) {
    const stillFloorM = Math.max(14, (accuracyM ?? 40) * 0.4);
    if (movedM < stillFloorM) return 0;
  }

  if (speed >= 12) {
    // Short window with almost no pin movement → leftover Doppler.
    if (dtSec != null && dtSec <= 5 && movedM < 15) return 0;
    if (dtSec == null && movedM < 18) return 0;

    if (dtSec != null && dtSec >= 1 && dtSec <= 90) {
      const disp = displacementKmh(movedM, dtSec);
      // Claimed car speed must be roughly matched by how far the pin moved.
      if (Number.isFinite(disp) && disp < Math.max(5, speed * 0.35)) {
        return disp < 1.5 ? 0 : Math.round(disp * 10) / 10;
      }
    }

    // Absolute: “40 km/h” with a <25m hop is multipath, not a drive.
    if (speed >= 25 && movedM < 25) return 0;
  }

  return speed;
}

/**
 * When the phone omits / zeros Doppler, invent pace from pin displacement.
 *
 * Dense Android fused samples (~2–4s) during a real drive often report speed 0
 * while the pin moves 30–70 m. Capping those hops to walking (~7.5) froze
 * Hamoudi-style drives at “8 km/h” and wiped destination/ETA (needs ≥8).
 *
 * Walk-cap short hops ONLY when the context still looks like a foot trip.
 * Parking multipath with a leftover trip can invent car speeds — gate that
 * narrowly (already slow + tiny hop), not every mid-drive 3-second sample.
 */
export function inventSpeedFromDisplacement(opts: {
  movedM: number | null;
  dtSec: number | null;
  /** Prefer walk-cap (park trail / Core Motion walking). */
  preferWalkCap?: boolean;
  motionActivity?: "stationary" | "walking" | "driving" | "unknown" | null;
  previousPresence?: "stationary" | "moving" | "driving" | "unknown" | null;
  lastSpeedKmh?: number | null;
  /** Live trip already open. */
  activeTrip?: boolean;
  /** Open trip already looks like a real drive (distance/samples/age). */
  tripLooksReal?: boolean;
}): number | null {
  const { movedM, dtSec } = opts;
  if (movedM == null || dtSec == null) return null;
  if (dtSec < 1.5 || dtSec > 120 || movedM < 20) return null;

  let dispKmh = displacementKmh(movedM, dtSec);
  if (!Number.isFinite(dispKmh) || dispKmh < 1.4 || dispKmh >= 160) return null;

  const last = sanitizeSpeedKmh(opts.lastSpeedKmh) ?? 0;
  // Open trip that already looks real, or prior drive pace — never walk-cap.
  // Do NOT require last >= 18: one capped hop used to lock the loop at 7.5.
  const continuingDrive =
    opts.activeTrip === true &&
    (opts.tripLooksReal === true ||
      last >= 12 ||
      movedM >= 40 ||
      opts.previousPresence === "driving" ||
      opts.motionActivity === "driving");
  const likelyDriving =
    continuingDrive ||
    opts.motionActivity === "driving" ||
    (opts.previousPresence === "driving" && last >= 8) ||
    last >= 14;

  // Clear vehicle-sized hop — escape a prior walk-cap lock.
  if (dispKmh >= 22 && movedM >= 30 && dtSec <= 12) {
    return Math.round(dispKmh * 10) / 10;
  }

  const walkContext =
    opts.preferWalkCap === true ||
    opts.motionActivity === "walking" ||
    (!likelyDriving &&
      (opts.previousPresence === "moving" ||
        opts.previousPresence === "stationary" ||
        opts.previousPresence === "unknown" ||
        opts.previousPresence == null) &&
      last < 12);

  // Clear outbound hop (leaving Home/work) — don't walk-cap a real departure.
  const clearDeparture =
    !opts.activeTrip &&
    movedM >= 45 &&
    dispKmh >= 20 &&
    dtSec >= 2.5 &&
    dtSec <= 12;

  // Parking multipath only: leftover trip + already crawl/stop + tiny hop
  // inventing highway speed. Mid-drive 25–44 m / 3 s samples must NOT match.
  const parkJitterOnTrip =
    opts.activeTrip === true &&
    !continuingDrive &&
    !opts.tripLooksReal &&
    last < 8 &&
    dtSec <= 5 &&
    movedM < 28 &&
    dispKmh >= 16;

  if (
    ((walkContext && !likelyDriving) || parkJitterOnTrip) &&
    !clearDeparture &&
    dtSec <= 8 &&
    movedM < 90 &&
    dispKmh >= 12
  ) {
    dispKmh = Math.min(dispKmh, 7.5);
  }

  return Math.round(dispKmh * 10) / 10;
}

/**
 * Stale Android/iOS last-known replayed with a far-away coordinate.
 * Fresh fixes should pass through other gates instead.
 */
export function isStaleCacheTeleport(opts: {
  movedM: number;
  fixAgeMs: number;
  accuracyM: number | null;
}): boolean {
  const { movedM, fixAgeMs, accuracyM } = opts;
  if (movedM < 8_000) return false;
  if (fixAgeMs >= 10 * 60_000 && movedM >= 25_000) return true;
  if (fixAgeMs >= 3 * 60_000 && movedM >= 80_000) return true;
  if (
    fixAgeMs >= 90_000 &&
    movedM >= 12_000 &&
    accuracyM != null &&
    accuracyM >= 1_500
  ) {
    return true;
  }
  return false;
}

/**
 * Whether to move the map pin to the new coordinates.
 * Reject teleports and reverse snaps; still allow liveness heartbeats.
 *
 * Driving uses a looser gate: sparse BG samples + typical ~40m accuracy were
 * freezing the pin, then the next accept looked like a teleport (jump/lag).
 */
export function shouldAcceptPinMove(opts: {
  movedM: number | null;
  dtSec: number | null;
  accuracyM: number | null;
  prevAccuracyM: number | null;
  prevHeadingDeg: number | null;
  moveBearingDeg: number | null;
  sanitizedSpeedKmh: number | null;
  /** Prior presence — driving members get highway-tolerant gates. */
  presenceHint?: "stationary" | "moving" | "driving" | "unknown" | null;
  /** GPS clock age (receive − recordedAt) when available. */
  fixAgeMs?: number | null;
}): boolean {
  const { movedM, accuracyM } = opts;
  if (movedM == null || movedM < 2) return true;

  // Don't trust stuck presence alone — leftover "driving" opened the highway
  // gate for parking-lot multipath and looked like lag/teleports.
  const driving =
    (opts.sanitizedSpeedKmh ?? 0) >= 14 ||
    (opts.presenceHint === "driving" && (opts.sanitizedSpeedKmh ?? 0) >= 8);

  if (
    opts.fixAgeMs != null &&
    isStaleCacheTeleport({
      movedM,
      fixAgeMs: opts.fixAgeMs,
      accuracyM,
    })
  ) {
    return false;
  }

  // Trans-oceanic hops are never valid — even the dt floor made these ~170 km/h.
  if (movedM > MAX_CATCHUP_JUMP_M) return false;
  if (movedM > MAX_STATIONARY_CATCHUP_M && !driving) return false;

  // Heartbeat-only rejects stamp lastLocationAt without moving the pin.
  // The next hop then has a tiny receive Δt and a large movedM → fake teleport.
  // Floor dt by a generous highway ceiling so frozen pins can catch up.
  const minDtForHop =
    movedM > 0
      ? Math.min(movedM / (170 / 3.6), MAX_HOP_DT_FLOOR_SEC)
      : 0; /* 170 km/h */
  const dtSec =
    opts.dtSec != null
      ? Math.max(opts.dtSec, minDtForHop)
      : minDtForHop > 0
        ? minDtForHop
        : null;

  if (dtSec == null) {
    // No clock — only accept short hops with decent accuracy.
    if (movedM > 120 && (accuracyM == null || accuracyM > 40) && !driving) {
      return false;
    }
    return true;
  }

  const implied = displacementKmh(movedM, dtSec);

  if (driving) {
    // True teleports only — 200+ km/h sustained hops or absurd leaps.
    if (implied > 200 && movedM > 150) return false;
    if (implied > 240) return false;

    // Keep large *forward* highway hops (Zeinab Tecumseh), but reject reverse
    // multipath / last-known snaps. Those jump the pin BACK with speed≈0
    // ("Stationary"), then the next live hop jumps FORWARD ("Driving").
    if (
      opts.prevHeadingDeg != null &&
      opts.moveBearingDeg != null &&
      movedM >= 25 &&
      movedM <= 420 &&
      angleDeltaDeg(opts.prevHeadingDeg, opts.moveBearingDeg) >= 135
    ) {
      const slowOrRough =
        (opts.sanitizedSpeedKmh ?? 0) < 28 ||
        accuracyM == null ||
        accuracyM > 28 ||
        implied > 85;
      if (slowOrRough) return false;
    }

    // Accuracy collapsed after a good drive fix — classic urban multipath bounce.
    if (
      opts.prevAccuracyM != null &&
      opts.prevAccuracyM <= 40 &&
      accuracyM != null &&
      accuracyM >= 55 &&
      movedM > 40 &&
      (opts.sanitizedSpeedKmh ?? 0) < 30
    ) {
      return false;
    }

    return true;
  }

  // Catch-up after a frozen pin (reject heartbeats kept lastLocationAt fresh
  // while the person drove home). A 3–15 km hop with decent accuracy is a
  // real move — the 140 km/h gate alone would reject it forever.
  // iOS often reports 50–90m accuracy on the first fused fix after leaving a
  // gym/mall; requiring ≤40/55m left people stuck at Goodlife while home.
  let catchUpOk = false;
  if (movedM >= 500 && implied < 200 && (accuracyM == null || accuracyM <= 120)) {
    catchUpOk = true;
  } else if (
    movedM >= 350 &&
    implied < 200 &&
    (accuracyM == null || accuracyM <= 90)
  ) {
    catchUpOk = true;
  } else if (
    movedM >= 180 &&
    accuracyM != null &&
    accuracyM <= 65 &&
    implied < 170 &&
    (opts.sanitizedSpeedKmh ?? 0) < 12
  ) {
    // Stationary/slow sample after shopping — accept the home hop.
    catchUpOk = true;
  }
  if (catchUpOk) {
    if (movedM > MAX_CATCHUP_JUMP_M) return false;
    if (movedM > MAX_STATIONARY_CATCHUP_M && !driving) return false;
    return true;
  }

  // Impossible ground speed → teleport (pin snaps ahead then back).
  if (implied > 140 && movedM > 60) return false;
  if (implied > 100 && (accuracyM == null || accuracyM > 35)) return false;
  if (implied > 80 && accuracyM != null && accuracyM > 60 && movedM > 80) {
    return false;
  }

  // Bounce inside the uncertainty circle — keep the last good pin.
  if (
    accuracyM != null &&
    accuracyM >= 40 &&
    movedM < accuracyM * 0.9 &&
    (opts.sanitizedSpeedKmh ?? 0) < 14
  ) {
    return false;
  }

  // Accuracy collapsed after a good fix — classic multipath snap.
  if (
    opts.prevAccuracyM != null &&
    opts.prevAccuracyM <= 35 &&
    accuracyM != null &&
    accuracyM >= 70 &&
    movedM > 35
  ) {
    return false;
  }

  // Abrupt reverse vs prior travel heading (back then forward again).
  if (
    opts.prevHeadingDeg != null &&
    opts.moveBearingDeg != null &&
    movedM >= 30 &&
    movedM <= 320 &&
    angleDeltaDeg(opts.prevHeadingDeg, opts.moveBearingDeg) >= 135
  ) {
    if (
      accuracyM == null ||
      accuracyM > 28 ||
      (opts.sanitizedSpeedKmh ?? 0) < 22 ||
      implied > 70
    ) {
      return false;
    }
  }

  return true;
}

/**
 * GPS quality gates for Family Map pins.
 * Goal: fewer false “Driving 40 km/h” over a house, and no snap-back /
 * snap-forward teleports that make it look like we lost the person.
 */
import { sanitizeSpeedKmh } from "@forward/shared";

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

  if (movedM == null) return speed;

  // Walking band: soft still-floor (first steps).
  // Driving band: harder — 42 km/h over a backyard must not stick.
  if (speed > 0 && speed < 8) {
    const stillFloorM = Math.max(5, (accuracyM ?? 40) * 0.18);
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
 * Whether to move the map pin to the new coordinates.
 * Reject teleports and reverse snaps; still allow liveness heartbeats.
 */
export function shouldAcceptPinMove(opts: {
  movedM: number | null;
  dtSec: number | null;
  accuracyM: number | null;
  prevAccuracyM: number | null;
  prevHeadingDeg: number | null;
  moveBearingDeg: number | null;
  sanitizedSpeedKmh: number | null;
}): boolean {
  const { movedM, dtSec, accuracyM } = opts;
  if (movedM == null || movedM < 2) return true;
  if (dtSec == null) {
    // No clock — only accept short hops with decent accuracy.
    if (movedM > 120 && (accuracyM == null || accuracyM > 40)) return false;
    return true;
  }

  const implied = displacementKmh(movedM, dtSec);

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

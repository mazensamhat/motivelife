/**
 * Family Intelligence — recognize park / gym walks as workouts (and usual routines).
 */

import type { FamilyPlaceCategory } from "@forward/shared";
import { isWalkingPaceKmh } from "@forward/shared";

const WORKOUT_NAME_RE =
  /\b(park|parks|gym|fitness|trail|trails|track|field|fields|rink|arena|court|courts|stadium|recreation|rec\b|athletic|workout|yoga|pilates|pool|beach|conservancy|greenway|boardwalk)\b/i;

export function isWorkoutPlace(opts: {
  placeName?: string | null;
  placeCategory?: FamilyPlaceCategory | string | null;
}): boolean {
  if (opts.placeCategory === "sports") return true;
  const name = opts.placeName?.trim() ?? "";
  if (!name) return false;
  return WORKOUT_NAME_RE.test(name);
}

export function isLikelyWorkoutActivity(opts: {
  presence: string;
  speedKmh?: number | null;
  placeName?: string | null;
  placeCategory?: FamilyPlaceCategory | string | null;
}): boolean {
  if (!isWorkoutPlace(opts)) return false;
  if (opts.presence === "moving" && isWalkingPaceKmh(opts.speedKmh)) return true;
  // Settled mid-walk / cool-down inside the park fence still counts.
  if (opts.presence === "stationary" || opts.presence === "unknown") return true;
  return false;
}

/**
 * True vehicle motion through a park/gym fence (road through the grounds).
 * Park GPS multipath routinely invents 20–40 km/h on short hops while walking —
 * those must NOT count as driving or they open ghost trips and kill the walk stay.
 *
 * Dense drive samples are often 2–5s / 40–80 m — requiring 120 m + 10 s made
 * real drives through/near parks stick at walking speed and kill predictions.
 */
export function isClearVehicleThroughWorkout(opts: {
  speedKmh?: number | null;
  movedM?: number | null;
  dtSec?: number | null;
  motionActivity?: string | null;
  /** Prior sample already looked like a car — keep treating as vehicle. */
  lastSpeedKmh?: number | null;
  activeTrip?: boolean;
}): boolean {
  const speed =
    opts.speedKmh != null && Number.isFinite(opts.speedKmh) ? opts.speedKmh : 0;
  const movedM =
    opts.movedM != null && Number.isFinite(opts.movedM) ? opts.movedM : 0;
  const dtSec =
    opts.dtSec != null && Number.isFinite(opts.dtSec) ? opts.dtSec : 0;
  const last =
    opts.lastSpeedKmh != null && Number.isFinite(opts.lastSpeedKmh)
      ? opts.lastSpeedKmh
      : 0;

  // An open drive that already left the trail — don't walk-cap over it.
  if (opts.activeTrip && (speed >= 18 || last >= 18) && movedM >= 35) {
    return true;
  }
  if (opts.motionActivity === "driving" && speed >= 22 && movedM >= 45) {
    return true;
  }
  // Sustained car-class motion — not a 2–6s GPS bounce along the trail.
  if (speed >= 28 && movedM >= 55 && dtSec >= 3) return true;
  if (speed >= 35 && movedM >= 80) return true;
  if (last >= 30 && speed >= 20 && movedM >= 40) return true;
  return false;
}

export type WorkoutLabelOpts = {
  placeName: string;
  /** Walking pace right now. */
  walking: boolean;
  /** Learned routine for this place (same weekday visits). */
  usual?: boolean;
  /** Minutes already at the place. */
  dwellMinutes?: number | null;
};

/**
 * Presence copy when someone is at a park/gym for exercise.
 * Gender-neutral — works for any household member.
 */
export function workoutPresenceLabel(opts: WorkoutLabelOpts): string {
  const place = opts.placeName.trim() || "the park";
  if (opts.usual && opts.walking) {
    return `Usual workout at ${place}`;
  }
  if (opts.usual) {
    return `On usual workout · ${place}`;
  }
  if (opts.walking) {
    return `Working out at ${place}`;
  }
  const mins = opts.dwellMinutes;
  if (mins != null && Number.isFinite(mins) && mins >= 1 && mins < 180) {
    return `Workout at ${place} · ${Math.round(mins)} min`;
  }
  return `At ${place} · workout`;
}

/** Compact pin chip under the avatar. */
export function workoutPinStatusLabel(opts: WorkoutLabelOpts): string {
  const place = opts.placeName.trim() || "Park";
  if (opts.usual) return opts.walking ? `Usual workout` : `Workout · ${place}`;
  if (opts.walking) return `Working out`;
  const mins = opts.dwellMinutes;
  if (mins != null && Number.isFinite(mins) && mins >= 1 && mins < 180) {
    return `Workout · ${Math.round(mins)}m`;
  }
  return `Workout · ${place}`;
}

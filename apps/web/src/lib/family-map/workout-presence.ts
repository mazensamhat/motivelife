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

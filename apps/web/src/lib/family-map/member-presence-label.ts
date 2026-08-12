import {
  isWalkingPaceKmh,
  type FamilyMapMemberView,
} from "@forward/shared";
import {
  isWorkoutPlace,
  workoutPinStatusLabel,
  workoutPresenceLabel,
} from "./workout-presence";

/** Compact dwell duration: `20 min`, `1h`, `1h 10m`. */
export function formatDwellDuration(mins: number): string {
  const n = Math.max(1, Math.round(mins));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const rem = n % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/**
 * Arrival clock from dwell minutes — e.g. `12:00 PM`.
 * Prefer this for longer stays so the line doesn't grow forever.
 */
export function formatArrivedSince(mins: number): string {
  const arrived = new Date(Date.now() - Math.max(1, mins) * 60_000);
  return arrived.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type PresenceLabelInput = Pick<
  FamilyMapMemberView,
  | "presence"
  | "placeName"
  | "placeCategory"
  | "statusLabel"
  | "speedKmh"
  | "timeAtPlaceMinutes"
  | "likelyDestination"
  | "etaMinutes"
  | "lat"
  | "lng"
  | "isYou"
> & {
  /** Learned weekday visits to this park/gym — Family Intelligence routine. */
  usualWorkout?: boolean;
};

/**
 * Household Home only — not other places saved with the "home" category
 * (e.g. "Inaam's parents' house").
 */
export function isHouseholdHomePlace(m: {
  placeName?: string | null;
  placeCategory?: string | null;
}): boolean {
  const name = m.placeName?.trim() ?? "";
  if (name) return /^home$/i.test(name);
  return m.placeCategory === "home";
}

function placeLabelOf(m: PresenceLabelInput): string | null {
  const named = m.placeName?.trim();
  if (named) return named;
  if (m.placeCategory === "home") return "Home";
  return null;
}

function workoutLabelOpts(m: PresenceLabelInput, placeLabel: string) {
  return {
    placeName: placeLabel,
    walking: isWalkingPaceKmh(m.speedKmh),
    usual: Boolean(m.usualWorkout),
    dwellMinutes: m.timeAtPlaceMinutes,
  };
}

/**
 * Life360-style line under each person:
 * - Driving / Walking
 * - Working out at Maguire Park / Usual workout at Maguire Park
 * - At Tim Hortons for 20 min
 * - At Tim Hortons since 12:00 PM (longer stays)
 */
export function memberPresenceSubtitle(m: PresenceLabelInput): string {
  if (m.lat == null || m.lng == null) {
    return m.isYou ? "Your location off" : "Location off";
  }

  if (m.presence === "driving") {
    if (m.likelyDestination && m.etaMinutes != null && m.etaMinutes > 0) {
      return `Driving to ${m.likelyDestination} · ETA ${m.etaMinutes} min`;
    }
    if (m.speedKmh != null && Number.isFinite(m.speedKmh) && m.speedKmh >= 8) {
      return `Driving · ${Math.round(m.speedKmh)} km/h`;
    }
    return "Driving";
  }

  const placeLabel = placeLabelOf(m);
  const workoutHere =
    placeLabel != null &&
    isWorkoutPlace({ placeName: placeLabel, placeCategory: m.placeCategory });

  if (m.presence === "moving") {
    if (isWalkingPaceKmh(m.speedKmh)) {
      if (workoutHere && placeLabel) {
        return workoutPresenceLabel(workoutLabelOpts(m, placeLabel));
      }
      if (m.placeName) return `Walking near ${m.placeName}`;
      return "Walking";
    }
    if (m.speedKmh != null && Number.isFinite(m.speedKmh) && m.speedKmh >= 1.5) {
      return `On the move · ${Math.round(m.speedKmh)} km/h`;
    }
    return "On the move";
  }

  if (placeLabel) {
    if (workoutHere) {
      // Short cool-downs / stretches still read as the workout, not a vague "At".
      const mins = m.timeAtPlaceMinutes;
      if (mins == null || mins < 150) {
        return workoutPresenceLabel(workoutLabelOpts(m, placeLabel));
      }
    }
    const mins = m.timeAtPlaceMinutes;
    if (mins != null && Number.isFinite(mins) && mins >= 1) {
      // Short/medium stays → "for 20 min". Longer → "since 12:00 PM".
      if (mins < 180) {
        return `At ${placeLabel} for ${formatDwellDuration(mins)}`;
      }
      return `At ${placeLabel} since ${formatArrivedSince(mins)}`;
    }
    return `At ${placeLabel}`;
  }

  const fallback = (m.statusLabel ?? "").trim();
  if (fallback && !/^unknown$/i.test(fallback) && !/^live$/i.test(fallback)) {
    return fallback;
  }
  return "Live";
}

/**
 * Shorter status for map pin chips under the avatar name.
 * Prefers `At Home · 45m` over the longer list/sheet wording.
 */
export function memberPinStatusLabel(m: PresenceLabelInput): string {
  if (m.lat == null || m.lng == null) return "";

  if (m.presence === "driving") {
    if (m.likelyDestination) return `→ ${m.likelyDestination}`;
    return "Driving";
  }

  const placeLabel = placeLabelOf(m);
  const workoutHere =
    placeLabel != null &&
    isWorkoutPlace({ placeName: placeLabel, placeCategory: m.placeCategory });

  if (m.presence === "moving") {
    if (workoutHere && placeLabel && isWalkingPaceKmh(m.speedKmh)) {
      return workoutPinStatusLabel(workoutLabelOpts(m, placeLabel));
    }
    return isWalkingPaceKmh(m.speedKmh) ? "Walking" : "On the move";
  }

  if (placeLabel) {
    if (workoutHere) {
      const mins = m.timeAtPlaceMinutes;
      if (mins == null || mins < 150) {
        return workoutPinStatusLabel(workoutLabelOpts(m, placeLabel));
      }
    }
    const mins = m.timeAtPlaceMinutes;
    if (mins != null && Number.isFinite(mins) && mins >= 1) {
      if (mins < 180) return `At ${placeLabel} · ${formatDwellDuration(mins)}`;
      return `At ${placeLabel} · since ${formatArrivedSince(mins)}`;
    }
    return `At ${placeLabel}`;
  }

  return "";
}

/** First token of a display name — map pins stay readable. */
export function memberFirstName(displayName: string | null | undefined): string {
  const raw = (displayName ?? "").trim();
  if (!raw) return "Someone";
  return raw.split(/\s+/)[0] ?? raw;
}

export type MemberPinMotionKind =
  | "home"
  | "place"
  | "driving"
  | "walking"
  | "workout"
  | "moving"
  | "idle";

/** Which micro-animation the pin status chip should play. */
export function memberPinMotionKind(m: PresenceLabelInput): MemberPinMotionKind {
  if (m.presence === "driving") return "driving";
  const workoutHere = isWorkoutPlace({
    placeName: m.placeName,
    placeCategory: m.placeCategory,
  });
  if (m.presence === "moving") {
    if (workoutHere && isWalkingPaceKmh(m.speedKmh)) return "workout";
    return isWalkingPaceKmh(m.speedKmh) ? "walking" : "moving";
  }
  if (m.placeCategory === "home" || /^home$/i.test(m.placeName ?? "")) return "home";
  if (workoutHere) return "workout";
  if (m.placeName) return "place";
  return "idle";
}

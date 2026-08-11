import {
  isWalkingPaceKmh,
  type FamilyMapMemberView,
} from "@forward/shared";

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
>;

function placeLabelOf(m: PresenceLabelInput): string | null {
  return (
    m.placeName?.trim() ||
    (m.placeCategory === "home" ? "Home" : null)
  );
}

/**
 * Life360-style line under each person:
 * - Driving / Walking
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

  if (m.presence === "moving") {
    if (isWalkingPaceKmh(m.speedKmh)) {
      if (m.placeName) return `Walking near ${m.placeName}`;
      return "Walking";
    }
    if (m.speedKmh != null && Number.isFinite(m.speedKmh) && m.speedKmh >= 1.5) {
      return `On the move · ${Math.round(m.speedKmh)} km/h`;
    }
    return "On the move";
  }

  const placeLabel = placeLabelOf(m);

  if (placeLabel) {
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
  if (m.presence === "moving") {
    return isWalkingPaceKmh(m.speedKmh) ? "Walking" : "On the move";
  }

  const placeLabel = placeLabelOf(m);
  if (placeLabel) {
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

export type MemberPinMotionKind = "home" | "place" | "driving" | "walking" | "moving" | "idle";

/** Which micro-animation the pin status chip should play. */
export function memberPinMotionKind(m: PresenceLabelInput): MemberPinMotionKind {
  if (m.presence === "driving") return "driving";
  if (m.presence === "moving") {
    return isWalkingPaceKmh(m.speedKmh) ? "walking" : "moving";
  }
  if (m.placeCategory === "home" || /^home$/i.test(m.placeName ?? "")) return "home";
  if (m.placeName) return "place";
  return "idle";
}

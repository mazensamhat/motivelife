/**
 * Motive Location Core — native ownership of share state, motion mode, and
 * adaptive GPS sampling. WebView UI still requests start/stop; this module
 * decides how aggressively we sample.
 *
 * Motion sources (best available):
 * 1. expo-location Motion Activity (Core Motion / Activity Recognition)
 * 2. GPS speed / displacement fallback
 */
import * as Location from "expo-location";
import { Platform } from "react-native";
import {
  resumeFamilyBackgroundIfNeeded,
  startFamilyBackgroundLocation,
  stopFamilyBackgroundLocation,
} from "./backgroundLocation";

export type MotionMode = "stationary" | "walking" | "driving" | "unknown";
export type TripHint = "idle" | "maybe_trip" | "in_trip" | "ending";

export type SamplingProfile = {
  id: MotionMode;
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
  deferredUpdatesInterval: number;
  activityType: Location.ActivityType;
};

/** Dense when driving; sparse when parked to cut battery + false motion. */
export const SAMPLING_PROFILES: Record<MotionMode, SamplingProfile> = {
  driving: {
    id: "driving",
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 8_000,
    distanceInterval: 5,
    deferredUpdatesInterval: 8_000,
    activityType: Location.ActivityType.AutomotiveNavigation,
  },
  walking: {
    id: "walking",
    accuracy: Location.Accuracy.High,
    timeInterval: 15_000,
    distanceInterval: 12,
    deferredUpdatesInterval: 15_000,
    activityType: Location.ActivityType.Fitness,
  },
  stationary: {
    id: "stationary",
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 45_000,
    distanceInterval: 35,
    deferredUpdatesInterval: 45_000,
    activityType: Location.ActivityType.Other,
  },
  unknown: {
    id: "unknown",
    accuracy: Location.Accuracy.High,
    timeInterval: 12_000,
    distanceInterval: 8,
    deferredUpdatesInterval: 12_000,
    activityType: Location.ActivityType.AutomotiveNavigation,
  },
};

type CoreState = {
  sharing: boolean;
  motion: MotionMode;
  tripHint: TripHint;
  lastSpeedKmh: number | null;
  lastLat: number | null;
  lastLng: number | null;
  lastAt: number | null;
  /** When Motion Activity last reported a useful mode. */
  lastActivityAt: number | null;
  /** Candidate motion awaiting hysteresis confirmation. */
  pendingMotion: MotionMode | null;
  pendingStreak: number;
  profileId: MotionMode;
  motionSource: "activity" | "speed" | "none";
};

let state: CoreState = {
  sharing: false,
  motion: "unknown",
  tripHint: "idle",
  lastSpeedKmh: null,
  lastLat: null,
  lastLng: null,
  lastAt: null,
  lastActivityAt: null,
  pendingMotion: null,
  pendingStreak: 0,
  profileId: "unknown",
  motionSource: "none",
};

let motionSub: Location.LocationSubscription | null = null;

/** Listeners for profile changes — backgroundLocation re-arms the OS task. */
type ProfileListener = (profile: SamplingProfile) => void;
const profileListeners = new Set<ProfileListener>();

export function onSamplingProfileChange(listener: ProfileListener): () => void {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

export function getLocationCoreState(): Readonly<CoreState> {
  return { ...state };
}

export function getCurrentSamplingProfile(): SamplingProfile {
  return SAMPLING_PROFILES[state.profileId];
}

export function inferMotionFromSpeed(speedKmh: number | null | undefined): MotionMode {
  if (speedKmh == null || !Number.isFinite(speedKmh)) return "unknown";
  if (speedKmh >= 12) return "driving";
  if (speedKmh >= 1.5) return "walking";
  return "stationary";
}

function motionFromActivityObject(activity: Location.MotionActivityObject): MotionMode {
  const a = activity.activities;
  // Prefer automotive even at medium confidence — densify GPS for drives.
  if (a.automotive?.detected && a.automotive.confidence !== Location.MotionActivityConfidence.Low) {
    return "driving";
  }
  if (a.cycling?.detected && a.cycling.confidence !== Location.MotionActivityConfidence.Low) {
    return "driving";
  }
  if (
    (a.walking?.detected || a.running?.detected) &&
    (a.walking?.confidence !== Location.MotionActivityConfidence.Low ||
      a.running?.confidence !== Location.MotionActivityConfidence.Low)
  ) {
    return "walking";
  }
  if (a.stationary?.detected) return "stationary";
  if (a.automotive?.detected) return "driving";
  return "unknown";
}

function tripHintFromMotion(motion: MotionMode, prev: TripHint): TripHint {
  if (motion === "driving") return "in_trip";
  if (motion === "walking") {
    if (prev === "in_trip") return "ending";
    return "maybe_trip";
  }
  if (motion === "stationary") {
    if (prev === "in_trip" || prev === "ending") return "ending";
    return "idle";
  }
  return prev;
}

function commitMotion(next: MotionMode, source: CoreState["motionSource"]): boolean {
  const nextTrip = tripHintFromMotion(next, state.tripHint);
  const nextProfileId: MotionMode = next === "unknown" ? state.profileId : next;
  const profileChanged = nextProfileId !== state.profileId && next !== "unknown";

  state = {
    ...state,
    motion: next === "unknown" ? state.motion : next,
    tripHint: nextTrip,
    pendingMotion: null,
    pendingStreak: 0,
    profileId: profileChanged ? nextProfileId : state.profileId,
    motionSource: source,
    lastActivityAt: source === "activity" ? Date.now() : state.lastActivityAt,
  };

  if (profileChanged) {
    const profile = SAMPLING_PROFILES[state.profileId];
    for (const listener of profileListeners) {
      try {
        listener(profile);
      } catch {
        // ignore
      }
    }
  }
  return profileChanged;
}

/**
 * Apply a motion candidate with hysteresis (2 agreeing samples), except strong
 * driving which switches immediately so we densify mid-trip.
 */
function applyMotionCandidate(
  inferred: MotionMode,
  source: CoreState["motionSource"],
  opts?: { force?: boolean }
): { profileChanged: boolean; profile: SamplingProfile } {
  if (inferred === "unknown") {
    return { profileChanged: false, profile: SAMPLING_PROFILES[state.profileId] };
  }

  if (opts?.force || inferred === state.motion) {
    commitMotion(inferred, source);
    return {
      profileChanged: false,
      profile: SAMPLING_PROFILES[state.profileId],
    };
  }

  // Fast path into driving
  if (inferred === "driving") {
    const changed = commitMotion("driving", source);
    return { profileChanged: changed, profile: SAMPLING_PROFILES[state.profileId] };
  }

  if (state.pendingMotion === inferred) {
    const streak = state.pendingStreak + 1;
    if (streak >= 2) {
      const changed = commitMotion(inferred, source);
      return { profileChanged: changed, profile: SAMPLING_PROFILES[state.profileId] };
    }
    state = { ...state, pendingMotion: inferred, pendingStreak: streak };
  } else {
    state = { ...state, pendingMotion: inferred, pendingStreak: 1 };
  }

  return { profileChanged: false, profile: SAMPLING_PROFILES[state.profileId] };
}

/**
 * Feed each successful GPS sample into the core. Returns true when the
 * adaptive sampling profile should be reapplied to the OS location task.
 */
export function noteLocationSample(opts: {
  lat: number;
  lng: number;
  speedKmh: number | null;
  atMs?: number;
}): { profileChanged: boolean; profile: SamplingProfile } {
  const at = opts.atMs ?? Date.now();
  state = {
    ...state,
    lastSpeedKmh: opts.speedKmh,
    lastLat: opts.lat,
    lastLng: opts.lng,
    lastAt: at,
  };

  // Activity Recognition wins when fresh; otherwise fall back to GPS speed.
  const activityFresh =
    state.motionSource === "activity" &&
    state.lastActivityAt != null &&
    Date.now() - state.lastActivityAt < 90_000;
  if (activityFresh) {
    // Still densify if GPS clearly shows a drive while activity lags.
    const fromSpeed = inferMotionFromSpeed(opts.speedKmh);
    if (fromSpeed === "driving" && state.motion !== "driving") {
      return applyMotionCandidate("driving", "speed", { force: true });
    }
    return { profileChanged: false, profile: SAMPLING_PROFILES[state.profileId] };
  }

  const inferred = inferMotionFromSpeed(opts.speedKmh);
  if (inferred === "driving" && (opts.speedKmh ?? 0) >= 16) {
    return applyMotionCandidate("driving", "speed", { force: true });
  }
  return applyMotionCandidate(inferred, "speed");
}

async function ensureMotionActivityPermission(): Promise<boolean> {
  try {
    const current = await Location.getMotionActivityPermissionsAsync();
    if (current.granted) return true;
    const asked = await Location.requestMotionActivityPermissionsAsync();
    return asked.granted;
  } catch (e) {
    console.warn(
      "[locationCore] motion activity permission",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

async function startMotionActivityWatch(): Promise<void> {
  if (motionSub) return;
  const ok = await ensureMotionActivityPermission();
  if (!ok) return;
  try {
    motionSub = await Location.watchMotionActivityAsync((activity) => {
      const mode = motionFromActivityObject(activity);
      applyMotionCandidate(mode, "activity", {
        force: mode === "driving" || mode === "stationary",
      });
    });
  } catch (e) {
    console.warn(
      "[locationCore] watchMotionActivityAsync failed",
      e instanceof Error ? e.message : e
    );
  }
}

async function stopMotionActivityWatch(): Promise<void> {
  if (!motionSub) return;
  try {
    motionSub.remove();
  } catch {
    // ignore
  }
  motionSub = null;
}

export async function startLocationCore(
  sessionToken: string,
  opts?: { promptAlways?: boolean }
) {
  const result = await startFamilyBackgroundLocation(sessionToken, opts);
  if (result.ok) {
    state = {
      ...state,
      sharing: true,
      profileId: "unknown",
      pendingMotion: null,
      pendingStreak: 0,
      motionSource: "none",
      lastActivityAt: null,
    };
    void startMotionActivityWatch();
  }
  return result;
}

export async function pauseLocationCore() {
  await stopMotionActivityWatch();
  await stopFamilyBackgroundLocation();
  state = {
    ...state,
    sharing: false,
    motion: "unknown",
    tripHint: "idle",
    pendingMotion: null,
    pendingStreak: 0,
    profileId: "unknown",
    motionSource: "none",
    lastActivityAt: null,
  };
}

export async function resumeLocationCore() {
  const result = await resumeFamilyBackgroundIfNeeded();
  if (result.ok) {
    state = { ...state, sharing: true };
    void startMotionActivityWatch();
  }
  return result;
}

/** Platform-safe default when core has no samples yet. */
export function defaultSamplingProfile(): SamplingProfile {
  void Platform; // keep import used for future platform splits
  return SAMPLING_PROFILES.unknown;
}

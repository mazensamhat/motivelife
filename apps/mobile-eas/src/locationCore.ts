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
  flushFamilyLocationHeartbeat,
  resumeFamilyBackgroundIfNeeded,
  startFamilyBackgroundLocation,
  stopFamilyBackgroundLocation,
} from "./backgroundLocation";
import { isLocationPaused } from "./locationPause";

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

/**
 * Dense when moving; sparse when parked.
 * Walking is intentionally near driving density — neighborhood walks and
 * indoor steps are the motion that should re-power GPS and keep the trail
 * usable, not just a label for "not driving."
 */
export const SAMPLING_PROFILES: Record<MotionMode, SamplingProfile> = {
  driving: {
    id: "driving",
    accuracy: Location.Accuracy.BestForNavigation,
    // Denser posts ≈ Life360 fluid follow (web coasts between fixes).
    timeInterval: 1_500,
    distanceInterval: 8,
    deferredUpdatesInterval: 1_500,
    activityType: Location.ActivityType.AutomotiveNavigation,
  },
  walking: {
    id: "walking",
    // High + Fitness: Core Motion / Activity Recognition notices steps and
    // densifies GPS so walk paths stay on sidewalks instead of lagging.
    accuracy: Location.Accuracy.High,
    timeInterval: 5_000,
    distanceInterval: 4,
    deferredUpdatesInterval: 5_000,
    activityType: Location.ActivityType.Fitness,
  },
  stationary: {
    id: "stationary",
    accuracy: Location.Accuracy.Balanced,
    // Android uses timeInterval. iOS ignores it and uses distanceFilter —
    // see locationTaskOptionsFromProfile (distanceInterval forced to 0 on iOS)
    // so sitting at home still delivers BG heartbeats.
    timeInterval: 20_000,
    distanceInterval: 0,
    deferredUpdatesInterval: 20_000,
    // Fitness: Core Location uses the motion coprocessor to notice walks
    // around the house and power GPS back up without a car trip.
    activityType: Location.ActivityType.Fitness,
  },
  unknown: {
    id: "unknown",
    accuracy: Location.Accuracy.High,
    timeInterval: 12_000,
    distanceInterval: 8,
    deferredUpdatesInterval: 12_000,
    activityType: Location.ActivityType.Fitness,
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
/** Last time phone-motion woke a GPS heartbeat (throttle). */
let lastMotionGpsWakeAt = 0;

/**
 * Phone motion (Core Motion / Activity Recognition — gyro, accel, steps)
 * says the person started moving. Keep last-known place ("at home"), but
 * force a GPS wake so household liveness and walk trails update immediately.
 *
 * Walking gets a shorter throttle than driving: short neighborhood walks are
 * exactly when we need the first few steps to re-arm GPS.
 */
function wakeGpsFromPhoneMotion(prev: MotionMode, next: MotionMode): void {
  if (!state.sharing) return;
  const nowMoving = next === "walking" || next === "driving";
  if (!nowMoving) return;

  const wasStill = prev === "stationary" || prev === "unknown";
  const gpsStale =
    state.lastAt == null || Date.now() - state.lastAt > 25_000;
  // Re-wake while already "walking" if GPS went quiet mid-walk (common indoors).
  const walkingNeedsRefresh = next === "walking" && gpsStale;
  if (!wasStill && !walkingNeedsRefresh) return;

  const throttleMs = next === "walking" ? 12_000 : 30_000;
  if (Date.now() - lastMotionGpsWakeAt < throttleMs) return;
  lastMotionGpsWakeAt = Date.now();
  console.warn(
    "[locationCore] phone motion — waking GPS for walk/drive tracking",
    prev,
    "→",
    next,
    gpsStale ? "(gps stale)" : ""
  );
  void flushFamilyLocationHeartbeat();
  void resumeFamilyBackgroundIfNeeded();
}

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
  // Walking/running: accept any detected confidence. Low-confidence steps are
  // still the best signal that someone stood up and started a walk — that is
  // when we want GPS to wake, not after a car trip classifier fires.
  if (a.walking?.detected || a.running?.detected) {
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
  const prevMotion = state.motion;
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

  if (source === "activity") {
    wakeGpsFromPhoneMotion(prevMotion, state.motion);
  }

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

  // Fast path into driving OR walking — motion activation matters more than
  // waiting for a second agreeing sample (walks are short; hysteresis loses them).
  if (inferred === "driving" || inferred === "walking") {
    const changed = commitMotion(inferred, source);
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
      // Force walking too — first step from Core Motion should densify GPS now.
      applyMotionCandidate(mode, "activity", {
        force:
          mode === "driving" ||
          mode === "walking" ||
          mode === "stationary",
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
  if (await isLocationPaused()) {
    return {
      ok: false as const,
      backgroundGranted: false,
      iosScope: null,
      message: "Live location is paused for this account until KINZO AI launches.",
    };
  }
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

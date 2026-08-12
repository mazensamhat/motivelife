/**
 * Bridge from the Fold-safe fused-location native module into Family Map posts.
 */
import type * as Location from "expo-location";
import {
  addFusedLocationErrorListener,
  addFusedLocationListener,
  isFusedLocationAvailable,
  isFusedLocationRunning,
  startFusedLocation,
  stopFusedLocation,
  updateFusedLocation,
  type FusedLocationFix,
  type FusedStartOptions,
} from "fused-location";
import type { SamplingProfile } from "./locationCore";

let locationSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;
let onFixHandler: ((pos: Location.LocationObject) => void) | null = null;

export function fusedLocationSupported(): boolean {
  return isFusedLocationAvailable();
}

export function fusedLocationRunning(): boolean {
  return isFusedLocationRunning();
}

export function fusedFixToLocationObject(
  fix: FusedLocationFix
): Location.LocationObject {
  return {
    coords: {
      latitude: fix.lat,
      longitude: fix.lng,
      altitude: null,
      accuracy: fix.accuracyM,
      altitudeAccuracy: null,
      heading: fix.headingDeg != null && fix.headingDeg >= 0 ? fix.headingDeg : null,
      speed: fix.speedMps != null && fix.speedMps >= 0 ? fix.speedMps : null,
    },
    timestamp: fix.recordedAtMs > 0 ? fix.recordedAtMs : Date.now(),
  } as Location.LocationObject;
}

function optionsFromProfile(profile: SamplingProfile): FusedStartOptions {
  const driving = profile.id === "driving";
  const walking = profile.id === "walking";
  return {
    intervalMs: driving ? 2_000 : walking ? 4_000 : Math.max(8_000, profile.timeInterval),
    fastestIntervalMs: driving ? 1_000 : walking ? 2_000 : 4_000,
    priority: driving || walking ? "high" : "balanced",
    notificationTitle: "MotiveLife Family Map",
    notificationBody: "Sharing your live location with your household",
  };
}

export async function startFusedFamilyTracking(opts: {
  profile: SamplingProfile;
  onFix: (pos: Location.LocationObject) => void;
}): Promise<boolean> {
  if (!isFusedLocationAvailable()) return false;
  onFixHandler = opts.onFix;

  if (!locationSub) {
    locationSub = addFusedLocationListener((fix) => {
      if (!onFixHandler) return;
      // Drop ancient fused leftovers (should be rare).
      const age = Date.now() - (fix.recordedAtMs || Date.now());
      if (age > 90_000) return;
      onFixHandler(fusedFixToLocationObject(fix));
    });
  }
  if (!errorSub) {
    errorSub = addFusedLocationErrorListener((message) => {
      console.warn("[fusedLocation] native error", message);
    });
  }

  try {
    await startFusedLocation(optionsFromProfile(opts.profile));
    return true;
  } catch (e) {
    console.warn(
      "[fusedLocation] start failed",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

export async function updateFusedFamilyTracking(
  profile: SamplingProfile
): Promise<void> {
  if (!isFusedLocationAvailable() || !isFusedLocationRunning()) return;
  try {
    await updateFusedLocation(optionsFromProfile(profile));
  } catch (e) {
    console.warn(
      "[fusedLocation] update failed",
      e instanceof Error ? e.message : e
    );
  }
}

export async function stopFusedFamilyTracking(): Promise<void> {
  onFixHandler = null;
  try {
    locationSub?.remove();
  } catch {
    // ignore
  }
  try {
    errorSub?.remove();
  } catch {
    // ignore
  }
  locationSub = null;
  errorSub = null;
  try {
    await stopFusedLocation();
  } catch {
    // ignore
  }
}

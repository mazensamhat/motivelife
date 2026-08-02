/**
 * MyMotiveFamily background / Always location updates.
 * Task must be defined at module scope (imported from index.ts).
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { WEB_URL } from "./config";

export const FAMILY_LOCATION_TASK = "motivelife-family-location";
const SESSION_KEY = "motivelife.sessionToken";
const SHARE_KEY = "motivelife.familyShareEnabled";

TaskManager.defineTask(FAMILY_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[backgroundLocation]", error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;

  const enabled = await SecureStore.getItemAsync(SHARE_KEY);
  if (enabled !== "1") return;

  const token = await SecureStore.getItemAsync(SESSION_KEY);
  if (!token) return;

  const latest = locations[locations.length - 1]!;
  const speedMs = latest.coords.speed;
  try {
    await fetch(`${WEB_URL}/api/family/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-MotiveLife-Session": token,
      },
      body: JSON.stringify({
        lat: latest.coords.latitude,
        lng: latest.coords.longitude,
        accuracyM: latest.coords.accuracy,
        speedKmh: speedMs != null && speedMs >= 0 ? speedMs * 3.6 : null,
        headingDeg:
          latest.coords.heading != null && latest.coords.heading >= 0
            ? latest.coords.heading
            : null,
        recordedAt: new Date(latest.timestamp).toISOString(),
      }),
    });
  } catch (e) {
    console.warn("[backgroundLocation] post failed", e);
  }
});

export async function saveNativeSessionToken(token: string | null) {
  if (!token) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function startFamilyBackgroundLocation(sessionToken: string): Promise<{
  ok: boolean;
  message: string;
  backgroundGranted: boolean;
}> {
  await saveNativeSessionToken(sessionToken);
  await SecureStore.setItemAsync(SHARE_KEY, "1");

  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    return {
      ok: false,
      backgroundGranted: false,
      message:
        Platform.OS === "ios"
          ? "Location Services are off. Turn them on in iPhone Settings → Privacy & Security → Location Services."
          : "Location is off on this phone. Turn on Location in system settings.",
    };
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return {
      ok: false,
      backgroundGranted: false,
      message:
        Platform.OS === "ios"
          ? 'Allow location: choose “Allow While Using App”, then we’ll ask for Always for live family sharing.'
          : "Allow Location for MotiveLife (While using the app), then choose Allow all the time for live family sharing.",
    };
  }

  const bg = await Location.requestBackgroundPermissionsAsync();
  const backgroundGranted = bg.status === Location.PermissionStatus.GRANTED;

  const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
  if (!started) {
    await Location.startLocationUpdatesAsync(FAMILY_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 45_000,
      distanceInterval: 40,
      deferredUpdatesInterval: 45_000,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: "MyMotiveFamily",
        notificationBody: "Sharing live location with your household",
        notificationColor: "#00c6ff",
      },
    });
  }

  if (!backgroundGranted) {
    return {
      ok: true,
      backgroundGranted: false,
      message:
        Platform.OS === "ios"
          ? "Live sharing is on while using the app. For Life360-style Always tracking: Settings → MotiveLife → Location → Always."
          : "Live sharing is on while using the app. For Always tracking: Settings → Apps → MotiveLife → Permissions → Location → Allow all the time.",
    };
  }

  return {
    ok: true,
    backgroundGranted: true,
    message: "Always / background location sharing is on.",
  };
}

export async function stopFamilyBackgroundLocation(): Promise<void> {
  await SecureStore.setItemAsync(SHARE_KEY, "0");
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
  } catch {
    // ignore
  }
}

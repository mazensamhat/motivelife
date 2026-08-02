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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

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

export type NativeLocationPermissionSnapshot = {
  servicesOn: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  /** iOS authorization scope from expo-location */
  iosScope: "whenInUse" | "always" | "none" | null;
  canAskAgain: boolean;
};

export async function getFamilyLocationPermissionSnapshot(): Promise<NativeLocationPermissionSnapshot> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  const iosScope = fg.ios?.scope ?? null;
  return {
    servicesOn,
    foregroundGranted: fg.status === Location.PermissionStatus.GRANTED,
    backgroundGranted: bg.status === Location.PermissionStatus.GRANTED,
    iosScope,
    canAskAgain: fg.canAskAgain !== false,
  };
}

/**
 * Request While Using → (brief settle) → Always, then start the background task.
 * Do not call requestBackground from the one-shot GPS path — iOS will drop the Always dialog.
 */
export async function startFamilyBackgroundLocation(sessionToken: string): Promise<{
  ok: boolean;
  message: string;
  backgroundGranted: boolean;
  iosScope: "whenInUse" | "always" | "none" | null;
}> {
  await saveNativeSessionToken(sessionToken);
  await SecureStore.setItemAsync(SHARE_KEY, "1");

  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    return {
      ok: false,
      backgroundGranted: false,
      iosScope: null,
      message:
        Platform.OS === "ios"
          ? "Location Services are off. Turn them on in iPhone Settings → Privacy & Security → Location Services."
          : "Location is off on this phone. Turn on Location in system settings.",
    };
  }

  // Step 1 — While Using the App (required before Always on iOS).
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    fg = await Location.requestForegroundPermissionsAsync();
  }
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return {
      ok: false,
      backgroundGranted: false,
      iosScope: fg.ios?.scope ?? "none",
      message:
        Platform.OS === "ios"
          ? 'Choose “Allow While Using App” (not “When I Share”). If Settings only shows When I Share: set Location → Never, reopen MotiveLife, tap Enable location, then pick While Using the App.'
          : "Allow Location for MotiveLife (While using the app), then choose Allow all the time for live family sharing.",
    };
  }

  // Step 2 — let iOS settle When-In-Use before asking for Always (critical on iOS 17/18).
  if (Platform.OS === "ios") {
    await sleep(800);
  }

  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== Location.PermissionStatus.GRANTED) {
    bg = await Location.requestBackgroundPermissionsAsync();
  }

  // Re-read scope after prompts — Settings UI follows this.
  const after = await getFamilyLocationPermissionSnapshot();
  const backgroundGranted =
    bg.status === Location.PermissionStatus.GRANTED || after.iosScope === "always";

  try {
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
  } catch (e) {
    console.warn("[backgroundLocation] start updates failed", e);
  }

  if (!backgroundGranted) {
    return {
      ok: true,
      backgroundGranted: false,
      iosScope: after.iosScope,
      message:
        Platform.OS === "ios"
          ? 'Live sharing works while MotiveLife is open. For background tracking: Settings → MotiveLife → Location → Always (you may need While Using the App first — not “When I Share”).'
          : "Live sharing is on while using the app. For Always tracking: Settings → Apps → MotiveLife → Permissions → Location → Allow all the time.",
    };
  }

  return {
    ok: true,
    backgroundGranted: true,
    iosScope: after.iosScope ?? "always",
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

/**
 * MyMotiveFamily background / Always location updates.
 * Task must be defined at module scope (imported from index.ts).
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
import { WEB_URL } from "./config";

export const FAMILY_LOCATION_TASK = "motivelife-family-location";
const SESSION_KEY = "motivelife.sessionToken";
const SHARE_KEY = "motivelife.familyShareEnabled";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Open system Location (GPS) settings — not app-info (where Location may be missing until granted). */
export async function openSystemLocationSettings(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      return true;
    }
    // iOS has no public deep-link to Location Services; app settings is closest.
    await Linking.openSettings();
    return true;
  } catch {
    try {
      await Linking.openSettings();
      return true;
    } catch {
      return false;
    }
  }
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
 * Android: request app Location permission FIRST (so it appears under
 * Settings → Apps → MotiveLife → Permissions), then prompt to turn on the
 * phone Location / GPS toggle via Play Services or system settings.
 */
export async function ensureAndroidLocationReady(): Promise<{
  ok: boolean;
  message: string;
  foregroundGranted: boolean;
  servicesOn: boolean;
}> {
  // 1) App permission — do this even if GPS appears off, otherwise Location
  // never shows as a toggle under the app’s Permissions screen.
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    fg = await Location.requestForegroundPermissionsAsync();
  }

  if (fg.status !== Location.PermissionStatus.GRANTED) {
    if (fg.canAskAgain === false) {
      await Linking.openSettings();
    }
    return {
      ok: false,
      foregroundGranted: false,
      servicesOn: await Location.hasServicesEnabledAsync(),
      message:
        fg.canAskAgain === false
          ? "Location permission is blocked. In the MotiveLife app settings that just opened: Permissions → Location → Allow (or Allow all the time)."
          : "Tap Allow on the Location permission dialog so MotiveLife can share your pin with your household.",
    };
  }

  // 2) Phone Location / GPS master switch
  let servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    try {
      // Shows the Google Play “Turn on location?” system dialog when possible.
      await Location.enableNetworkProviderAsync();
    } catch {
      await openSystemLocationSettings();
    }
    await sleep(600);
    servicesOn = await Location.hasServicesEnabledAsync();
  }

  if (!servicesOn) {
    await openSystemLocationSettings();
    return {
      ok: false,
      foregroundGranted: true,
      servicesOn: false,
      message:
        "Phone Location is still off. Turn on Location (GPS) in the system screen that opened, then return to MotiveLife and tap Enable location again.",
    };
  }

  return {
    ok: true,
    foregroundGranted: true,
    servicesOn: true,
    message: "Location ready.",
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

  if (Platform.OS === "android") {
    const ready = await ensureAndroidLocationReady();
    if (!ready.ok) {
      return {
        ok: false,
        backgroundGranted: false,
        iosScope: null,
        message: ready.message,
      };
    }
  } else {
    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      return {
        ok: false,
        backgroundGranted: false,
        iosScope: null,
        message:
          "Location Services are off. Turn them on in iPhone Settings → Privacy & Security → Location Services.",
      };
    }

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
          'Choose “Allow While Using App” (not “When I Share”). If Settings only shows When I Share: set Location → Never, reopen MotiveLife, tap Enable location, then pick While Using the App.',
      };
    }
    await sleep(800);
  }

  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== Location.PermissionStatus.GRANTED) {
    bg = await Location.requestBackgroundPermissionsAsync();
  }

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
    iosScope: after.iosScope ?? (Platform.OS === "ios" ? "always" : null),
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

/**
 * MyMotiveFamily background / Always location updates.
 * Task must be defined at module scope (imported from index.ts).
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Alert, AppState, Dimensions, Linking, Platform } from "react-native";
import {
  checkAndroidForegroundLocation,
  requestAndroidBackgroundLocation,
  requestAndroidForegroundLocation,
} from "./androidLocationPermissions";
import { WEB_URL } from "./config";

export const FAMILY_LOCATION_TASK = "motivelife-family-location";
const SESSION_KEY = "motivelife.sessionToken";
const SHARE_KEY = "motivelife.familyShareEnabled";

/** Coalesce deferred FGS starts so permission UI + enable tap don't race on Fold. */
let androidFgsTimer: ReturnType<typeof setTimeout> | null = null;
let androidFgsInFlight = false;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Galaxy Z Fold / Flip detection.
 * Prefer model/brand (SM-F*) over aspect ratio so unfolded inner display still matches.
 */
export function isLikelyAndroidFoldable(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    const c = Platform.constants as {
      Brand?: string;
      Manufacturer?: string;
      Model?: string;
      Fingerprint?: string;
    };
    const hay =
      `${c.Brand ?? ""} ${c.Manufacturer ?? ""} ${c.Model ?? ""} ${c.Fingerprint ?? ""}`.toLowerCase();
    // Galaxy Z Fold / Flip model codes are SM-F…
    if (/sm-f\d|z[\s_-]*fold|z[\s_-]*flip|galaxy[\s_-]*fold|galaxy[\s_-]*flip/.test(hay)) {
      return true;
    }
    if (hay.includes("fold") || hay.includes("flip")) return true;
  } catch {
    // fall through to geometry
  }
  const win = Dimensions.get("window");
  const screen = Dimensions.get("screen");
  const min = Math.min(win.width, win.height, screen.width, screen.height);
  const max = Math.max(win.width, win.height, screen.width, screen.height);
  const aspect = max / Math.max(min, 1);
  return aspect >= 2.05 || min >= 580;
}

/**
 * Family-test kill switch: location FGS hard-crashes Z Fold.
 * Use foreground polling on ALL Android until Fold is proven stable.
 * (S26 Ultra still gets live pins via the same poll.)
 */
export function shouldAvoidAndroidLocationFgs(): boolean {
  return Platform.OS === "android";
}

function androidDeviceLabel(): string {
  try {
    const c = Platform.constants as { Brand?: string; Model?: string };
    return `${c.Brand ?? "android"} ${c.Model ?? ""}`.trim();
  } catch {
    return "android";
  }
}

/** Wait until the app is active again after permission / GPS settings UIs. */
async function waitForAppActive(timeoutMs = 8_000): Promise<void> {
  if (AppState.currentState === "active") return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve();
    }, timeoutMs);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    });
  });
}

/**
 * Z Fold / Android 12+: starting a location foreground service while the
 * activity is still settling after a permission or settings UI can hard-crash
 * the process. Always wait for active + a short settle, even if already active.
 */
export async function settleAfterAndroidUi(extraMs = 650): Promise<void> {
  if (Platform.OS !== "android") return;
  await waitForAppActive();
  await sleep(extraMs);
}

/** Wait until AppState has stayed active continuously for `stableMs`. */
async function waitForStableActive(stableMs = 2_000, timeoutMs = 12_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await waitForAppActive(Math.max(500, deadline - Date.now()));
    if (AppState.currentState !== "active") continue;
    const startedAt = Date.now();
    let interrupted = false;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        sub.remove();
        resolve();
      }, stableMs);
      const sub = AppState.addEventListener("change", (state) => {
        if (state !== "active") {
          interrupted = true;
          clearTimeout(timer);
          sub.remove();
          resolve();
        }
      });
    });
    if (!interrupted && Date.now() - startedAt >= stableMs - 50) return true;
  }
  return AppState.currentState === "active";
}

async function startAndroidLocationUpdatesOnce(): Promise<void> {
  const options = {
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
  };

  const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
  if (started) return;
  await Location.startLocationUpdatesAsync(FAMILY_LOCATION_TASK, options);
}

async function postFamilyLocationFix(pos: Location.LocationObject): Promise<void> {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  if (!token) return;
  const speedMs = pos.coords.speed;
  await fetch(`${WEB_URL}/api/family/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-MotiveLife-Session": token,
    },
    body: JSON.stringify({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyM: pos.coords.accuracy,
      speedKmh: speedMs != null && speedMs >= 0 ? speedMs * 3.6 : null,
      headingDeg:
        pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
      recordedAt: new Date(pos.timestamp).toISOString(),
    }),
  });
}

/** Android live sharing without a foreground service (Fold-safe). */
let androidPollTimer: ReturnType<typeof setInterval> | null = null;

async function postAndroidForegroundFix(): Promise<void> {
  try {
    const share = await SecureStore.getItemAsync(SHARE_KEY);
    if (share !== "1") return;
    if (AppState.currentState !== "active") return;
    // NEVER call getCurrentPositionAsync here — it hard-crashes Z Fold
    // when started near a permission/settings transition.
    const pos = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60_000,
      requiredAccuracy: 500,
    });
    if (!pos) return;
    await postFamilyLocationFix(pos);
  } catch (e) {
    console.warn(
      "[backgroundLocation] android poll failed",
      e instanceof Error ? e.message : e
    );
  }
}

function startAndroidForegroundPoll(): void {
  if (androidPollTimer) return;
  console.warn(
    `[backgroundLocation] Android FGS disabled (${androidDeviceLabel()}) — last-known poll only`
  );
  // Delay first poll so we are clear of any permission UI.
  setTimeout(() => {
    void postAndroidForegroundFix();
  }, 4_000);
  androidPollTimer = setInterval(() => {
    void postAndroidForegroundFix();
  }, 45_000);
}

function stopAndroidForegroundPoll(): void {
  if (androidPollTimer) {
    clearInterval(androidPollTimer);
    androidPollTimer = null;
  }
}

/**
 * Android location updates.
 * NUCLEAR: never start a location foreground service on Android during family
 * testing — Z Fold hard-crashes; polling last-known is enough for live pins
 * while the app is open.
 */
function scheduleAndroidLocationUpdates(_opts?: { delayMs?: number }): void {
  if (Platform.OS !== "android") return;

  if (androidFgsTimer) {
    clearTimeout(androidFgsTimer);
    androidFgsTimer = null;
  }

  // Stop any FGS an older APK may have left running.
  void (async () => {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
      if (started) await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
    } catch {
      // ignore
    }
  })();

  if (shouldAvoidAndroidLocationFgs()) {
    startAndroidForegroundPoll();
    return;
  }

  // Kept for a future re-enable on phones only — currently unreachable.
  const delayMs = 900;
  androidFgsTimer = setTimeout(() => {
    androidFgsTimer = null;
    void (async () => {
      if (androidFgsInFlight) return;
      androidFgsInFlight = true;
      try {
        const share = await SecureStore.getItemAsync(SHARE_KEY);
        if (share !== "1") return;
        const stable = await waitForStableActive(800, 15_000);
        if (!stable) return;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await settleAfterAndroidUi(attempt === 1 ? 400 : 800);
            await startAndroidLocationUpdatesOnce();
            return;
          } catch (e) {
            console.warn(
              `[backgroundLocation] deferred FGS attempt ${attempt}/3 failed`,
              e instanceof Error ? e.message : e
            );
          }
        }
      } finally {
        androidFgsInFlight = false;
      }
    })();
  }, delayMs);
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

export function promptAndroidLocationSettingsHelp(kind: "app" | "gps") {
  if (Platform.OS !== "android") return;
  const title = kind === "gps" ? "Turn on phone Location" : "Allow Location for MotiveLife";
  const message =
    kind === "gps"
      ? "Open the Location screen and turn Location ON (GPS). Then return to MotiveLife and tap Enable location again."
      : "In Settings → Apps → MotiveLife → Permissions → Location, choose Allow (or Allow all the time).\n\nIf Location is missing from the list, uninstall MotiveLife and install EAS build v1.0.14+ from apps/mobile-eas.";

  Alert.alert(title, message, [
    { text: "Not now", style: "cancel" },
    {
      text: kind === "gps" ? "Open Location settings" : "Open app settings",
      onPress: () => {
        void (kind === "gps" ? openSystemLocationSettings() : Linking.openSettings());
      },
    },
  ]);
}

/**
 * Android: request app Location permission FIRST (so it appears under
 * Settings → Apps → MotiveLife → Permissions), then prompt to turn on the
 * phone Location / GPS toggle via Play Services or system settings.
 */
export async function ensureAndroidLocationReady(opts?: {
  /** When false, never show permission dialogs — resume path only. */
  prompt?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  foregroundGranted: boolean;
  servicesOn: boolean;
}> {
  const prompt = opts?.prompt !== false;

  // 1) Prefer check-only when resuming. Only request on an explicit user allow.
  const checked = await checkAndroidForegroundLocation();
  let rn = checked;
  let fg = await Location.getForegroundPermissionsAsync();

  if (fg.status !== Location.PermissionStatus.GRANTED && !(checked.fine || checked.coarse)) {
    if (!prompt) {
      return {
        ok: false,
        foregroundGranted: false,
        servicesOn: await Location.hasServicesEnabledAsync(),
        message: "Location permission is off.",
      };
    }
    rn = await requestAndroidForegroundLocation();
    fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      fg = await Location.requestForegroundPermissionsAsync();
    }
  }

  const foregroundGranted =
    fg.status === Location.PermissionStatus.GRANTED || rn.fine || rn.coarse;

  if (!foregroundGranted) {
    if (prompt) {
      promptAndroidLocationSettingsHelp("app");
      if (!rn.canAskAgain || fg.canAskAgain === false) {
        await Linking.openSettings();
      }
    }
    return {
      ok: false,
      foregroundGranted: false,
      servicesOn: await Location.hasServicesEnabledAsync(),
      message:
        !rn.canAskAgain || fg.canAskAgain === false
          ? "Location permission is blocked. In MotiveLife app settings: Permissions → Location → Allow (or Allow all the time)."
          : "Tap Allow on the Location permission dialog so MotiveLife can share your pin with your household.",
    };
  }

  // 2) Phone Location / GPS master switch
  let servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn && prompt) {
    // Never call enableNetworkProviderAsync — Play Services resolution UI
    // hard-crashes the MotiveLife WebView process on Z Fold.
    promptAndroidLocationSettingsHelp("gps");
    await openSystemLocationSettings();
    await sleep(800);
    servicesOn = await Location.hasServicesEnabledAsync();
  }

  if (!servicesOn) {
    if (prompt) {
      promptAndroidLocationSettingsHelp("gps");
      await openSystemLocationSettings();
    }
    return {
      ok: false,
      foregroundGranted: true,
      servicesOn: false,
      message:
        "Phone Location is still off. Turn on Location (GPS) in the system screen that opened, then return to MotiveLife and tap Enable location again.",
    };
  }

  // Permission / GPS settings just closed — give the Fold activity a beat.
  if (prompt) {
    await settleAfterAndroidUi(500);
  }

  return {
    ok: true,
    foregroundGranted: true,
    servicesOn: true,
    message: "Location ready.",
  };
}

/** Read a GPS fix without showing any permission dialogs. */
export async function readFamilyLocationFixSilent(): Promise<
  | {
      ok: true;
      fix: {
        lat: number;
        lng: number;
        accuracyM: number | null;
        speedKmh: number | null;
        headingDeg: number | null;
        recordedAt: string;
      };
    }
  | { ok: false; reason: "denied" | "unavailable" | "error"; message: string }
> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    return {
      ok: false,
      reason: "unavailable",
      message: "Phone Location is off.",
    };
  }

  if (Platform.OS === "android") {
    const ready = await ensureAndroidLocationReady({ prompt: false });
    if (!ready.ok) {
      return {
        ok: false,
        reason: ready.foregroundGranted ? "unavailable" : "denied",
        message: ready.message,
      };
    }
  } else {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      return {
        ok: false,
        reason: "denied",
        message: "Location permission is off.",
      };
    }
  }

  try {
    // Android (esp. Z Fold): NEVER call getCurrentPositionAsync — it hard-crashes
    // near permission UI. Last-known only; poll refreshes while the app is open.
    if (Platform.OS === "android") {
      const pos = await Location.getLastKnownPositionAsync({
        maxAge: 10 * 60_000,
        requiredAccuracy: 1000,
      });
      if (!pos) {
        return {
          ok: false,
          reason: "error",
          message: "Waiting for a GPS fix — keep MotiveLife open a moment.",
        };
      }
      const speedMs = pos.coords.speed;
      return {
        ok: true,
        fix: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
          speedKmh:
            speedMs != null && speedMs >= 0 ? Math.round(speedMs * 3.6 * 10) / 10 : null,
          headingDeg:
            pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
          recordedAt: new Date(pos.timestamp).toISOString(),
        },
      };
    }

    // iOS: Prefer a fresh GPS read. Last-known-first was freezing pins at home.
    let pos =
      (await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: false,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
      ])) ?? null;

    if (!pos) {
      pos =
        (await Location.getLastKnownPositionAsync({
          maxAge: 12_000,
          requiredAccuracy: 80,
        })) ?? null;
    }

    if (!pos) {
      return { ok: false, reason: "error", message: "Could not read GPS yet." };
    }

    const ageMs = Math.max(0, Date.now() - pos.timestamp);
    if (ageMs > 45_000) {
      return {
        ok: false,
        reason: "error",
        message: "GPS fix is stale — waiting for a fresh read.",
      };
    }

    const speedMs = pos.coords.speed;
    return {
      ok: true,
      fix: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? null,
        speedKmh:
          speedMs != null && speedMs >= 0 ? Math.round(speedMs * 3.6 * 10) / 10 : null,
        headingDeg:
          pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
        recordedAt: new Date(pos.timestamp).toISOString(),
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Could not read GPS.",
    };
  }
}

/** Native alert that opens Settings so the user can leave “When I Share”. */
export function promptIosLocationSettingsHelp(kind: "whenInUse" | "always") {
  if (Platform.OS !== "ios") return;
  const title =
    kind === "always" ? "Turn on Always location" : "Location stuck on “When I Share”";
  const message =
    kind === "always"
      ? 'In Settings → MotiveLife → Location, choose Always.\n\nIf you only see “Ask Next Time Or When I Share”, tap While Using the App first, return here, then Enable location again for Always.'
      : '“Ask Next Time Or When I Share” is not enough for Family Map.\n\n1. Open Settings → MotiveLife → Location\n2. Tap While Using the App (or Always)\n3. Return to MotiveLife and tap Enable location again\n\nDo not leave it on When I Share. Do not pick Allow Once.';

  Alert.alert(title, message, [
    { text: "Not now", style: "cancel" },
    {
      text: "Open Settings",
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

/**
 * Start the background task.
 * - promptAlways=true (user tapped Allow): may request Always / all-the-time.
 * - promptAlways=false (app resume): never show permission dialogs or Always nags.
 */
export async function startFamilyBackgroundLocation(
  sessionToken: string,
  opts?: { promptAlways?: boolean }
): Promise<{
  ok: boolean;
  message: string;
  backgroundGranted: boolean;
  iosScope: "whenInUse" | "always" | "none" | null;
}> {
  const promptAlways = opts?.promptAlways === true;
  await saveNativeSessionToken(sessionToken);
  await SecureStore.setItemAsync(SHARE_KEY, "1");

  if (Platform.OS === "android") {
    const ready = await ensureAndroidLocationReady({ prompt: promptAlways });
    if (!ready.ok) {
      return {
        ok: false,
        backgroundGranted: false,
        iosScope: null,
        message: ready.message,
      };
    }
    // Skip "Allow all the time" on Android — second dialog + FGS is the crash path.
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
      if (!promptAlways) {
        return {
          ok: false,
          backgroundGranted: false,
          iosScope: fg.ios?.scope ?? "none",
          message: "Location permission is off.",
        };
      }
      // "Ask Next Time Or When I Share" reports as not granted — prompt once from user tap.
      fg = await Location.requestForegroundPermissionsAsync();
    }
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      if (promptAlways) promptIosLocationSettingsHelp("whenInUse");
      return {
        ok: false,
        backgroundGranted: false,
        iosScope: fg.ios?.scope ?? "none",
        message:
          'Location is stuck on “When I Share” / not allowed. In Settings → MotiveLife → Location choose While Using the App (or Always), then tap Enable location again.',
      };
    }
    if (promptAlways) {
      // Brief settle so iOS can show the Always upgrade dialog.
      await sleep(1000);
    }
  }

  let bg = await Location.getBackgroundPermissionsAsync();
  if (
    bg.status !== Location.PermissionStatus.GRANTED &&
    promptAlways &&
    Platform.OS !== "android"
  ) {
    bg = await Location.requestBackgroundPermissionsAsync();
  }

  const after = await getFamilyLocationPermissionSnapshot();
  const backgroundGranted =
    bg.status === Location.PermissionStatus.GRANTED || after.iosScope === "always";

  // Start updates whenever foreground is allowed — don't require Always for in-app pins.
  // Android: NEVER start the location FGS synchronously after permission UI.
  // Z Fold hard-crashes there; S26 Ultra is fine with the same code path deferred.
  if (after.foregroundGranted) {
    try {
      if (Platform.OS === "android") {
        scheduleAndroidLocationUpdates();
      } else {
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
      }
    } catch (e) {
      console.warn("[backgroundLocation] start updates failed", e);
    }
  }

  if (!backgroundGranted) {
    if (promptAlways && Platform.OS === "ios") {
      promptIosLocationSettingsHelp("always");
    }
    const androidSafe = Platform.OS === "android";
    return {
      ok: true,
      backgroundGranted: false,
      iosScope: after.iosScope,
      message: promptAlways
        ? Platform.OS === "ios"
          ? 'Still not Always. Open Settings → MotiveLife → Location → Always (set While Using first if you only see “When I Share”). Then return and tap Enable location.'
          : androidSafe
            ? "Live location is on while MotiveLife is open (Android safe mode — no background service)."
            : "Live sharing is on while using the app. For Always tracking: Settings → Apps → MotiveLife → Permissions → Location → Allow all the time."
        : androidSafe
          ? "Live location resumed (Android safe mode)."
          : "Live location resumed.",
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
  if (androidFgsTimer) {
    clearTimeout(androidFgsTimer);
    androidFgsTimer = null;
  }
  stopAndroidForegroundPoll();
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
  } catch {
    // ignore
  }
}

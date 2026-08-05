/**
 * Android first-launch privacy reminder — same idea as iOS priming.
 * Settings may already list these from the manifest; we still walk the
 * system Allow / Don’t allow sheets so users get an explicit reminder
 * before Family Map / Voice / camera features need them.
 *
 * Fold-safe: skip POST_NOTIFICATIONS (extra dialogs have crashed Z Fold).
 */
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { PermissionsAndroid, Platform } from "react-native";
import {
  requestAndroidBackgroundLocation,
  requestAndroidForegroundLocation,
} from "./androidLocationPermissions";
import { isLocationPaused } from "./locationPause";

/** Bump to re-show the reminder tour on next install/upgrade. */
const PRIMED_KEY = "motivelife.androidPrivacyPrimed.v1";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Local copy — avoid importing backgroundLocation from the prime path. */
function isLikelyAndroidFoldable(): boolean {
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
    if (/sm-f\d|z[\s_-]*fold|z[\s_-]*flip|galaxy[\s_-]*fold|galaxy[\s_-]*flip/.test(hay)) {
      return true;
    }
    return hay.includes("fold") || hay.includes("flip");
  } catch {
    return false;
  }
}

async function requestAndroidActivityRecognition(): Promise<boolean> {
  const perm = PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION;
  if (!perm) return false;
  try {
    const already = await PermissionsAndroid.check(perm);
    if (already) return true;
    const status = await PermissionsAndroid.request(perm, {
      title: "Physical activity",
      message:
        "MyMotiveFamily uses phone motion (steps / walking) so live tracking wakes when you start moving — not only when you drive.",
      buttonPositive: "Allow",
      buttonNegative: "Not now",
    });
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function requestAndroidNotifications(): Promise<boolean> {
  // Android 13+ only. Skip on Fold — stacked permission UIs have hard-crashed it.
  if (isLikelyAndroidFoldable()) return false;
  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (!perm) return false;
  try {
    const already = await PermissionsAndroid.check(perm);
    if (already) return true;
    const status = await PermissionsAndroid.request(perm, {
      title: "Notifications",
      message:
        "MotiveLife can show a live-sharing notice while MyMotiveFamily keeps your pin updated in the background.",
      buttonPositive: "Allow",
      buttonNegative: "Not now",
    });
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Run the system permission sheets (one at a time). */
export async function requestAllAndroidPrivacyPermissions(): Promise<{
  location: boolean;
  backgroundLocation: boolean;
  motion: boolean;
  notifications: boolean;
  microphone: boolean;
  camera: boolean;
}> {
  const result = {
    location: false,
    backgroundLocation: false,
    motion: false,
    notifications: false,
    microphone: false,
    camera: false,
  };
  if (Platform.OS !== "android") return result;

  // Pre-launch fixed-home members: never prompt for Location.
  const skipLocation = await isLocationPaused();
  if (!skipLocation) {
    try {
      const loc = await requestAndroidForegroundLocation();
      result.location = loc.fine || loc.coarse;
      // Always also touch “Allow all the time” when we can — closed-app / geofence.
      if (result.location) {
        await sleep(450);
        result.backgroundLocation = await requestAndroidBackgroundLocation();
      }
    } catch (e) {
      console.warn(
        "[androidPermissions] location",
        e instanceof Error ? e.message : e
      );
    }
  }

  await sleep(400);
  try {
    result.motion = await requestAndroidActivityRecognition();
    // Also poke expo-location’s motion API when available (same OS permission).
    try {
      await Location.requestMotionActivityPermissionsAsync();
    } catch {
      // older expo-location builds
    }
  } catch (e) {
    console.warn(
      "[androidPermissions] motion",
      e instanceof Error ? e.message : e
    );
  }

  await sleep(350);
  try {
    result.notifications = await requestAndroidNotifications();
  } catch (e) {
    console.warn(
      "[androidPermissions] notifications",
      e instanceof Error ? e.message : e
    );
  }

  await sleep(350);
  try {
    const mic = await requestRecordingPermissionsAsync();
    result.microphone = Boolean(mic.granted);
  } catch (e) {
    console.warn(
      "[androidPermissions] microphone",
      e instanceof Error ? e.message : e
    );
    try {
      const mic2 = await getRecordingPermissionsAsync();
      result.microphone = Boolean(mic2.granted);
    } catch {
      /* ignore */
    }
  }

  await sleep(350);
  try {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    result.camera = Boolean(cam.granted);
  } catch (e) {
    console.warn(
      "[androidPermissions] camera",
      e instanceof Error ? e.message : e
    );
  }

  try {
    await SecureStore.setItemAsync(PRIMED_KEY, "1");
  } catch (e) {
    console.warn(
      "[androidPermissions] secure store write",
      e instanceof Error ? e.message : e
    );
  }
  return result;
}

async function needsFullPrime(): Promise<boolean> {
  try {
    const already = await SecureStore.getItemAsync(PRIMED_KEY);
    if (already !== "1") return true;
  } catch {
    return true;
  }
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status === Location.PermissionStatus.UNDETERMINED) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Launch / upgrade: walk Allow / Don’t allow sheets without a blocking intro.
 */
export function primeAndroidPrivacyPermissions(opts?: {
  force?: boolean;
}): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();

  return (async () => {
    const force = opts?.force === true;
    if (!force) {
      const need = await needsFullPrime();
      if (!need) return;
    }
    await requestAllAndroidPrivacyPermissions();
  })();
}

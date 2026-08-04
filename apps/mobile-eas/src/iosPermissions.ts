/**
 * Force iOS privacy prompts so Settings → MotiveLife lists Location / Photos /
 * Microphone / Camera. Info.plist keys alone do NOT create those rows —
 * iOS only adds them after CLLocationManager / PHPhotoLibrary / AVAudioSession
 * authorization APIs run.
 *
 * No blocking Alert — previous builds hid the system sheets behind an intro
 * dialog that was easy to miss over the WebView. System prompts are enough.
 */
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Bump whenever we need every install to see the permission sheets again. */
const PRIMED_KEY = "motivelife.iosPrivacyPrimed.v5";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Run the actual system permission sheets (one at a time). */
export async function requestAllIosPrivacyPermissions(): Promise<{
  location: boolean;
  microphone: boolean;
  camera: boolean;
  photos: boolean;
  health: boolean;
}> {
  const result = {
    location: false,
    microphone: false,
    camera: false,
    photos: false,
    health: false,
  };
  if (Platform.OS !== "ios") return result;

  try {
    // Always call request* — get-only does not create Settings rows on a fresh install.
    const loc = await Location.requestForegroundPermissionsAsync();
    result.location = loc.status === Location.PermissionStatus.GRANTED;
    // Always also request "Always" when we can ask — Settings needs the Always API
    // touch even if the user only grants When In Use.
    if (
      loc.status === Location.PermissionStatus.GRANTED ||
      loc.canAskAgain !== false
    ) {
      await sleep(400);
      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch (e) {
        console.warn(
          "[iosPermissions] always location",
          e instanceof Error ? e.message : e
        );
      }
    }
  } catch (e) {
    console.warn(
      "[iosPermissions] location",
      e instanceof Error ? e.message : e
    );
  }

  await sleep(350);
  try {
    const mic = await requestRecordingPermissionsAsync();
    result.microphone = Boolean(mic.granted);
  } catch (e) {
    console.warn(
      "[iosPermissions] microphone",
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
      "[iosPermissions] camera",
      e instanceof Error ? e.message : e
    );
  }

  await sleep(350);
  try {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    result.photos = Boolean(lib.granted);
  } catch (e) {
    console.warn(
      "[iosPermissions] photos",
      e instanceof Error ? e.message : e
    );
  }

  try {
    await SecureStore.setItemAsync(PRIMED_KEY, "1");
  } catch (e) {
    console.warn(
      "[iosPermissions] secure store write",
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
    // Fail open — never skip priming because SecureStore failed.
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
 * Launch / upgrade: run every system sheet without a blocking intro Alert.
 */
export function primeIosPrivacyPermissions(opts?: {
  /** When true, skip the primed check and request immediately. */
  force?: boolean;
}): Promise<void> {
  if (Platform.OS !== "ios") return Promise.resolve();

  return (async () => {
    const force = opts?.force === true;
    if (!force) {
      const need = await needsFullPrime();
      if (!need) return;
    }
    await requestAllIosPrivacyPermissions();
  })();
}

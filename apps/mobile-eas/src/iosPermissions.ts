/**
 * Force iOS privacy prompts so Settings → MotiveLife lists Location / Photos /
 * Microphone / Camera. Info.plist keys alone do NOT create those rows —
 * iOS only adds them after CLLocationManager / PHPhotoLibrary / AVAudioSession
 * authorization APIs run.
 *
 * HealthKit is deferred until a RN-compatible HealthKit package builds cleanly
 * on Expo SDK 56. Health will appear under Privacy → Health → Apps once we
 * ship HKHealthStore authorization.
 */
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from "react-native";

/** Bump whenever we need every install to see the permission sheets again. */
const PRIMED_KEY = "motivelife.iosPrivacyPrimed.v4";

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
    if (result.location) {
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

  await SecureStore.setItemAsync(PRIMED_KEY, "1");
  return result;
}

async function needsFullPrime(): Promise<boolean> {
  const already = await SecureStore.getItemAsync(PRIMED_KEY);
  if (already !== "1") return true;
  // If an older build marked primed but Location was never decided, re-run.
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status === Location.PermissionStatus.UNDETERMINED) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * First-launch / explicit: explain, then run every system sheet.
 * Returns a promise that resolves after the user finishes the sheets (or skips).
 */
export function primeIosPrivacyPermissions(opts?: {
  /** When true, skip the intro alert and request immediately. */
  force?: boolean;
}): Promise<void> {
  if (Platform.OS !== "ios") return Promise.resolve();

  return (async () => {
    const force = opts?.force === true;
    if (!force) {
      const need = await needsFullPrime();
      if (!need) return;
    }

    await new Promise<void>((resolve) => {
      Alert.alert(
        "Allow MotiveLife access",
        "Next you’ll see Apple permission screens for Location, Microphone, Camera, and Photos.\n\nTap Allow on each so they appear under Settings → MotiveLife.",
        [
          {
            text: "Continue",
            onPress: () => {
              void requestAllIosPrivacyPermissions().finally(() => resolve());
            },
          },
        ],
        { cancelable: false }
      );
    });
  })();
}

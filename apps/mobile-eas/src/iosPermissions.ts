/**
 * Touch iOS privacy permissions once so Settings → MotiveLife lists them.
 * Health Connect is Android-only — iOS has no Health row by design today.
 */
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Platform } from "react-native";

let primed = false;

export async function primeIosPrivacyPermissions(): Promise<void> {
  if (Platform.OS !== "ios" || primed) return;
  primed = true;
  try {
    // Location — Family Map. Requesting once creates the Settings row.
    const loc = await Location.getForegroundPermissionsAsync();
    if (loc.status !== Location.PermissionStatus.GRANTED && loc.canAskAgain !== false) {
      await Location.requestForegroundPermissionsAsync();
    }
  } catch (e) {
    console.warn("[iosPermissions] location", e instanceof Error ? e.message : e);
  }
  try {
    const mic = await Audio.getPermissionsAsync();
    if (!mic.granted && mic.canAskAgain !== false) {
      await Audio.requestPermissionsAsync();
    }
  } catch (e) {
    console.warn("[iosPermissions] microphone", e instanceof Error ? e.message : e);
  }
  try {
    const cam = await ImagePicker.getCameraPermissionsAsync();
    if (!cam.granted && cam.canAskAgain !== false) {
      await ImagePicker.requestCameraPermissionsAsync();
    }
  } catch (e) {
    console.warn("[iosPermissions] camera", e instanceof Error ? e.message : e);
  }
  try {
    const lib = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!lib.granted && lib.canAskAgain !== false) {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
  } catch (e) {
    console.warn("[iosPermissions] photos", e instanceof Error ? e.message : e);
  }
}

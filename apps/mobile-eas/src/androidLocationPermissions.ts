/**
 * Android location permission requests via React Native PermissionsAndroid.
 * More reliable than relying only on expo-location for the system dialog +
 * making Location appear under Settings → Apps → MotiveLife → Permissions.
 */
import { PermissionsAndroid, Platform } from "react-native";

export type AndroidLocationPermissionResult = {
  fine: boolean;
  coarse: boolean;
  background: boolean;
  canAskAgain: boolean;
  message: string;
};

function isGranted(value: string | undefined) {
  return value === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestAndroidForegroundLocation(): Promise<AndroidLocationPermissionResult> {
  if (Platform.OS !== "android") {
    return {
      fine: false,
      coarse: false,
      background: false,
      canAskAgain: true,
      message: "Not Android.",
    };
  }

  try {
    // Notifications help the foreground-service banner on Android 13+.
    if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      try {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } catch {
        // optional
      }
    }

    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const fine = isGranted(result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
    const coarse = isGranted(result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]);
    const fineStatus = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const canAskAgain = fineStatus !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

    if (!fine && !coarse) {
      return {
        fine: false,
        coarse: false,
        background: false,
        canAskAgain,
        message: canAskAgain
          ? "Tap Allow on the Location permission dialog for MotiveLife."
          : "Location is blocked for MotiveLife. Open Settings → Apps → MotiveLife → Permissions → Location → Allow.",
      };
    }

    return {
      fine,
      coarse,
      background: false,
      canAskAgain: true,
      message: "Foreground location granted.",
    };
  } catch (e) {
    return {
      fine: false,
      coarse: false,
      background: false,
      canAskAgain: true,
      message: e instanceof Error ? e.message : "Could not request Location permission.",
    };
  }
}

/** Call only after foreground location is granted (Android 10+ requirement). */
export async function requestAndroidBackgroundLocation(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const perm = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
  if (!perm) return false;
  try {
    const status = await PermissionsAndroid.request(perm, {
      title: "Allow all the time",
      message:
        "MyMotiveFamily needs Location “Allow all the time” so your household can see your live pin when MotiveLife is in the background.",
      buttonPositive: "Allow",
      buttonNegative: "Not now",
    });
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

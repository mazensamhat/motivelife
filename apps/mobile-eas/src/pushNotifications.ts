/**
 * Expo push registration for Life360-style lock-screen family alerts.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { WEB_URL } from "./config";
import { readNativeSessionToken } from "./backgroundLocation";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let lastRegisteredToken: string | null = null;
let androidChannelReady = false;

async function ensureAndroidChannel() {
  if (Platform.OS !== "android" || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync("family-alerts", {
    name: "Family alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 120, 250],
    lightColor: "#2F80ED",
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  androidChannelReady = true;
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return (
    extra?.eas?.projectId ||
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

async function postTokenToServer(token: string, session: string | null) {
  const base = WEB_URL.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session) headers.Authorization = `Bearer ${session}`;

  const res = await fetch(`${base}/api/devices/push-token`, {
    method: "POST",
    headers,
    // Cookie session from WebView login also works when Bearer is missing.
    credentials: "include",
    body: JSON.stringify({
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    }),
  });
  return res.ok;
}

export async function registerFamilyPushToken(): Promise<string | null> {
  try {
    await ensureAndroidChannel();

    // Always use Expo's permission API (works on Fold too). The Android
    // privacy tour skips PermissionsAndroid.POST_NOTIFICATIONS on foldables
    // to avoid crashy stacked dialogs — this path is safer and still required
    // for lock-screen family alerts.
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
        },
      });
      status = asked.status;
    }
    if (status !== "granted") {
      console.warn("[push] notification permission not granted", status);
      return null;
    }

    const id = projectId();
    const tokenRes = id
      ? await Notifications.getExpoPushTokenAsync({ projectId: id })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data?.trim();
    if (!token) return null;

    lastRegisteredToken = token;

    const session = await readNativeSessionToken();
    if (!session) {
      // Keep token; retry after login / cookie sync.
      return token;
    }

    const ok = await postTokenToServer(token, session);
    if (!ok) {
      console.warn("[push] register failed");
      return null;
    }
    return token;
  } catch (error) {
    console.warn("[push] register threw", error);
    return null;
  }
}

/** Call after session cookie/token lands so we can attach the device to the user. */
export async function syncFamilyPushTokenAfterLogin() {
  if (lastRegisteredToken) {
    try {
      const session = await readNativeSessionToken();
      await postTokenToServer(lastRegisteredToken, session);
    } catch {
      // ignore
    }
    return;
  }
  await registerFamilyPushToken();
}

export function getLastPushToken() {
  return lastRegisteredToken;
}

export function hrefFromNotificationResponse(
  response: Notifications.NotificationResponse | null
): string | null {
  if (!response) return null;
  const data = response.notification?.request?.content?.data as
    | { href?: string; url?: string; type?: string }
    | undefined;
  const raw =
    (typeof data?.href === "string" && data.href) ||
    (typeof data?.url === "string" && data.url) ||
    null;
  const type = typeof data?.type === "string" ? data.type : "";
  // Match server isFamilyPushType / isFamilyInboxAlertType — empty type still
  // means family-alerts channel for lock-screen taps.
  const familyType =
    !type ||
    type.startsWith("family_") ||
    type.includes("geofence") ||
    type.includes("road") ||
    type.includes("weather") ||
    type.includes("ping") ||
    type.includes("driving");

  const normalize = (href: string): string | null => {
    if (href.startsWith("/")) return href;
    try {
      const u = new URL(href);
      return `${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  };

  const isModeOfLifePath = (path: string) =>
    path === "/" ||
    path === "/dashboard" ||
    path.startsWith("/dashboard?") ||
    path.startsWith("/dashboard#") ||
    path === "/my-life" ||
    path.startsWith("/my-life?") ||
    path.startsWith("/my-life#") ||
    path === "/mylife" ||
    path.startsWith("/mylife");

  if (raw) {
    const path = normalize(raw);
    if (path) {
      // Never dump family alerts onto Mode of Life / My Life.
      if (familyType && isModeOfLifePath(path)) {
        return "/family-map";
      }
      return path;
    }
  }

  // Channel is family-alerts — missing data still opens My Family.
  return familyType ? "/family-map" : null;
}

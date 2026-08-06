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
  const data = response?.notification?.request?.content?.data as
    | { href?: string }
    | undefined;
  const href = typeof data?.href === "string" ? data.href : null;
  if (!href) return "/family-map";
  if (href.startsWith("/")) return href;
  try {
    const u = new URL(href);
    return `${u.pathname}${u.search}`;
  } catch {
    return "/family-map";
  }
}

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

export async function registerFamilyPushToken(): Promise<string | null> {
  try {
    await ensureAndroidChannel();

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return null;

    const id = projectId();
    const tokenRes = id
      ? await Notifications.getExpoPushTokenAsync({ projectId: id })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data?.trim();
    if (!token) return null;

    const session = await readNativeSessionToken();
    if (!session) {
      // Keep token; retry after login.
      lastRegisteredToken = token;
      return token;
    }

    const base = WEB_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/api/devices/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
      }),
    });
    if (!res.ok) {
      console.warn("[push] register failed", res.status);
      return null;
    }
    lastRegisteredToken = token;
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
      if (!session) return;
      const base = WEB_URL.replace(/\/$/, "");
      await fetch(`${base}/api/devices/push-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify({
          token: lastRegisteredToken,
          platform: Platform.OS === "ios" ? "ios" : "android",
        }),
      });
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

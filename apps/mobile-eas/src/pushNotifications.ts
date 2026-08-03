/**
 * Expo Push registration for Life360-style Family alerts.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { WEB_URL } from "./config";

const SESSION_KEY = "motivelife.sessionToken";

export async function registerFamilyPushToken(opts?: {
  sessionToken?: string | null;
  appVersion?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    // Lazy import so web/metro can still load if native module isn't linked yet.
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("family-alerts", {
        name: "Family alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00c6ff",
      });
    }

    const perms = await Notifications.getPermissionsAsync();
    let status = perms.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") {
      return { ok: false, message: "Push permission not granted." };
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data;
    if (!token) return { ok: false, message: "No Expo push token." };

    const session =
      opts?.sessionToken ?? (await SecureStore.getItemAsync(SESSION_KEY));
    if (!session) return { ok: false, message: "Not signed in." };

    const res = await fetch(`${WEB_URL}/api/push/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session}`,
        "X-MotiveLife-Session": session,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: opts?.appVersion ?? null,
      }),
    });

    if (!res.ok) {
      return { ok: false, message: `Register failed (${res.status}).` };
    }
    return { ok: true, message: "Push registered." };
  } catch (e) {
    console.warn("[push] register failed", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Push register failed.",
    };
  }
}

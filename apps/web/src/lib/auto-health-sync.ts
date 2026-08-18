/**
 * Automatic wearable / phone health pull.
 * Fitbit is refreshed server-side when status/Vitalu loads; this client
 * path reads Apple Health / Health Connect from the native shell.
 */

import { isNativeAndroidShell, isNativeIosShell, isNativeShell } from "@/lib/native-shell";

export const HEALTH_AUTO_UPDATED_EVENT = "motivelife-health-updated";

const LAST_ATTEMPT_KEY = "ml_health_auto_at";
const PHONE_OK_KEY = "ml_health_phone_ok";
const PHONE_DENIED_KEY = "ml_health_auto_denied_at";

const MIN_INTERVAL_MS = 12 * 60 * 1000;
const DENIED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type AutoHealthSyncResult = {
  ran: boolean;
  updated: boolean;
};

function nativeHealthBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    __MOTIVELIFE_NATIVE_HEALTH__?: boolean;
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  };
  return Boolean(
    w.__MOTIVELIFE_NATIVE_HEALTH__ ||
      (isNativeShell() && w.ReactNativeWebView?.postMessage) ||
      isNativeIosShell() ||
      isNativeAndroidShell()
  );
}

function readNum(key: string): number {
  try {
    return Number(window.localStorage.getItem(key) || 0) || 0;
  } catch {
    return 0;
  }
}

function writeNum(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota */
  }
}

function healthContextPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/vitalu") ||
    pathname.startsWith("/health") ||
    pathname.startsWith("/integrations")
  );
}

function shouldReadPhoneHealth(pathname: string | null | undefined): boolean {
  if (!nativeHealthBridgeAvailable()) return false;
  if (readNum(PHONE_DENIED_KEY) && Date.now() - readNum(PHONE_DENIED_KEY) < DENIED_COOLDOWN_MS) {
    return false;
  }
  try {
    if (window.localStorage.getItem(PHONE_OK_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return healthContextPath(pathname);
}

export function markPhoneHealthEnabled() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PHONE_OK_KEY, "1");
    window.localStorage.removeItem(PHONE_DENIED_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyHealthAutoUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HEALTH_AUTO_UPDATED_EVENT));
}

/**
 * Pull phone health if the native shell can read it.
 * Throttled so dashboard + Vitalu + app-foreground don't stampede.
 */
export async function autoSyncHealth(opts?: {
  force?: boolean;
  pathname?: string | null;
}): Promise<AutoHealthSyncResult> {
  if (typeof window === "undefined") return { ran: false, updated: false };

  const now = Date.now();
  if (!opts?.force) {
    const last = readNum(LAST_ATTEMPT_KEY);
    if (last && now - last < MIN_INTERVAL_MS) return { ran: false, updated: false };
  }

  if (!shouldReadPhoneHealth(opts?.pathname ?? window.location.pathname)) {
    return { ran: false, updated: false };
  }

  writeNum(LAST_ATTEMPT_KEY, now);

  try {
    const { syncHealthConnectFromDevice } = await import("@/lib/capacitor-health-bridge");
    const result = await syncHealthConnectFromDevice();
    if (result.ok && result.count > 0) {
      try {
        window.localStorage.setItem(PHONE_OK_KEY, "1");
        window.localStorage.removeItem(PHONE_DENIED_KEY);
      } catch {
        /* ignore */
      }
      notifyHealthAutoUpdated();
      return { ran: true, updated: true };
    }
    if (!result.ok && /denied|permission|not available|Update MotiveLife/i.test(result.error)) {
      writeNum(PHONE_DENIED_KEY, now);
    }
    if (result.ok) {
      try {
        window.localStorage.setItem(PHONE_OK_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    return { ran: true, updated: false };
  } catch {
    return { ran: true, updated: false };
  }
}

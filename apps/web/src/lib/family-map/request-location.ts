import { isNativeShell, getNativeShellPlatform } from "@/lib/native-shell";
import {
  canUseNativeLocationBridge,
  openNativeAppSettings,
  requestNativeLocationFix,
} from "@/lib/family-map/native-location-bridge";

export type LocationAccess =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" | "error"; message: string };

const SHARE_PREF_KEY = "mymotivelife.family.shareLive";

/** Persist opt-in so Fold users don’t re-tap every session after granting. */
export function readShareLivePreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SHARE_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeShareLivePreference(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(SHARE_PREF_KEY, "1");
    else window.localStorage.removeItem(SHARE_PREF_KEY);
  } catch {
    // ignore
  }
}

function deniedMessage(): string {
  const platform = getNativeShellPlatform();
  if (platform === "ios") {
    return 'Location is not allowed yet. Tap Enable location and choose “Allow While Using App”. If Settings only shows “When I Share”, set Location to Never, reopen MotiveLife, tap Enable location, then pick While Using the App.';
  }
  if (platform === "android" || isNativeShell()) {
    return "Location is blocked for MotiveLife. Open phone Settings → Apps → MotiveLife → Permissions → Location → Allow (or Precise), then tap Enable location again.";
  }
  return "Location is blocked for this site. Tap the lock icon in the address bar → Permissions → Location → Allow, then try again.";
}

/** True when OS/browser already granted location (no prompt). */
export async function hasLocationPermission(): Promise<boolean> {
  // Expo bridge — ask for a quick fix; if granted we get coords
  if (canUseNativeLocationBridge()) {
    // Don't prompt here — only report known-granted via browser Permissions when available
  }

  try {
    const mod = await import("@capacitor/geolocation").catch(() => null);
    if (mod?.Geolocation && isNativeShell() && !canUseNativeLocationBridge()) {
      const perm = await mod.Geolocation.checkPermissions();
      const state = perm.location ?? perm.coarseLocation;
      return state === "granted";
    }
  } catch {
    // ignore
  }

  try {
    const status = await navigator.permissions?.query({
      name: "geolocation" as PermissionName,
    });
    return status?.state === "granted";
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(onTimeout());
    }, ms);
    void promise.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(
          onTimeout()
        );
      }
    );
  });
}

/**
 * Explicitly ask for location from a user tap.
 * Expo AppShell (Fold/Play) → native expo-location bridge.
 * Capacitor → @capacitor/geolocation.
 * Browser → navigator.geolocation.
 */
export async function requestLocationAccess(): Promise<LocationAccess> {
  // 1) Expo / React Native WebView bridge (production mobile app)
  if (canUseNativeLocationBridge()) {
    const result = await requestNativeLocationFix(18_000);
    if (result.ok) return { ok: true };
    return {
      ok: false,
      reason: result.reason,
      message: result.message || deniedMessage(),
    };
  }

  // 2) Capacitor plugin path (legacy Capacitor builds)
  try {
    const mod = await import("@capacitor/geolocation").catch(() => null);
    if (mod?.Geolocation && isNativeShell()) {
      try {
        const perm = await mod.Geolocation.requestPermissions();
        const state = perm.location ?? perm.coarseLocation;
        if (state === "denied") {
          return { ok: false, reason: "denied", message: deniedMessage() };
        }
      } catch {
        // continue
      }

      try {
        await mod.Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12_000,
        });
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Location error";
        if (/denied|permission/i.test(msg)) {
          return { ok: false, reason: "denied", message: deniedMessage() };
        }
        return { ok: false, reason: "error", message: msg };
      }
    }
  } catch {
    // browser path
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      ok: false,
      reason: "unavailable",
      message: isNativeShell()
        ? "Location isn’t available in this app build. Update MotiveLife from the store, then try again."
        : "This browser can’t share location.",
    };
  }

  try {
    const status = await navigator.permissions?.query({
      name: "geolocation" as PermissionName,
    });
    if (status?.state === "denied") {
      return { ok: false, reason: "denied", message: deniedMessage() };
    }
  } catch {
    // query unsupported
  }

  const browserResult = await withTimeout<LocationAccess>(
    new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve({ ok: true }),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            resolve({ ok: false, reason: "denied", message: deniedMessage() });
            return;
          }
          resolve({
            ok: false,
            reason: "error",
            message: err.message || "Could not get location.",
          });
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 }
      );
    }),
    15_000,
    () => ({
      ok: false,
      reason: "error",
      message:
        getNativeShellPlatform() === "ios"
          ? 'GPS timed out. In Settings → MotiveLife → Location choose While Using the App (not “When I Share”), then tap Enable location again.'
          : isNativeShell()
            ? "Location timed out. Open phone Settings → MotiveLife → Location → Allow, then try Enable location again."
            : "Location timed out. Check browser location permission and try again.",
    })
  );

  return browserResult;
}

export function tryOpenAppSettings(): boolean {
  return openNativeAppSettings();
}

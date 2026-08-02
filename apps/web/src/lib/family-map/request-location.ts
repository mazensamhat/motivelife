import { isNativeShell } from "@/lib/native-shell";

export type LocationAccess =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" | "error"; message: string };

/**
 * Explicitly ask for location — Capacitor requestPermissions on native,
 * getCurrentPosition prompt on web. Call this from a user tap only.
 */
export async function requestLocationAccess(): Promise<LocationAccess> {
  try {
    const mod = await import("@capacitor/geolocation").catch(() => null);
    if (mod?.Geolocation && isNativeShell()) {
      try {
        const perm = await mod.Geolocation.requestPermissions();
        const state = perm.location ?? perm.coarseLocation;
        if (state === "denied") {
          return {
            ok: false,
            reason: "denied",
            message:
              "Location is blocked for MotiveLife. Open phone Settings → Apps → MotiveLife → Permissions → Location → Allow.",
          };
        }
      } catch {
        // continue to getCurrentPosition
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
          return {
            ok: false,
            reason: "denied",
            message:
              "Location is blocked for MotiveLife. Open phone Settings → Apps → MotiveLife → Permissions → Location → Allow.",
          };
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
      message: "This browser can’t share location.",
    };
  }

  // Permissions API — if already denied, don’t pretend a toggle will work
  try {
    const status = await navigator.permissions?.query({
      name: "geolocation" as PermissionName,
    });
    if (status?.state === "denied") {
      return {
        ok: false,
        reason: "denied",
        message: isNativeShell()
          ? "Location is blocked. Open phone Settings → Apps → MotiveLife → Permissions → Location → Allow, then tap Enable again."
          : "Location is blocked for this site. Tap the lock icon in the address bar → Permissions → Location → Allow, then tap Enable again.",
      };
    }
  } catch {
    // query unsupported — fall through to prompt
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ ok: true }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({
            ok: false,
            reason: "denied",
            message: isNativeShell()
              ? "Location permission denied. Enable it in Settings → Apps → MotiveLife → Permissions → Location."
              : "Location permission denied. Allow it via the lock icon in the address bar, then try again.",
          });
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
  });
}

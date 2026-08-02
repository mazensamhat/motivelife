/**
 * Expo AppShell ↔ Web location bridge.
 * The Fold / Play app is react-native-webview — not Capacitor Geolocation.
 * Native uses expo-location; web asks via postMessage.
 */

export type NativeLocationFix = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
};

type NativeLocationResult =
  | { requestId: string; ok: true; fix: NativeLocationFix }
  | { requestId: string; ok: false; reason: "denied" | "unavailable" | "error"; message: string };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __MOTIVELIFE_NATIVE_LOCATION__?: boolean;
  }
}

export function canUseNativeLocationBridge(): boolean {
  if (typeof window === "undefined") return false;
  // Only new AppShell builds set this flag + handle request_location.
  // Older builds have ReactNativeWebView but ignore location messages.
  return Boolean(
    window.__MOTIVELIFE_NATIVE_LOCATION__ && window.ReactNativeWebView?.postMessage
  );
}

function postToNative(payload: Record<string, unknown>) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
}

/** One-shot fix via Expo Location in the native shell. */
export function requestNativeLocationFix(timeoutMs = 18_000): Promise<NativeLocationResult> {
  if (!canUseNativeLocationBridge()) {
    return Promise.resolve({
      requestId: "none",
      ok: false,
      reason: "unavailable",
      message: "Native location bridge unavailable.",
    });
  }

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `loc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NativeLocationResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("motivelife-location", onEvent as EventListener);
      resolve(result);
    };

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<NativeLocationResult>).detail;
      if (!detail || detail.requestId !== requestId) return;
      finish(detail);
    };

    const timer = window.setTimeout(() => {
      finish({
        requestId,
        ok: false,
        reason: "error",
        message:
          'GPS timed out. On iPhone: Settings → MotiveLife → Location → While Using the App (not “When I Share”), then tap Enable location again.',
      });
    }, timeoutMs);

    window.addEventListener("motivelife-location", onEvent as EventListener);
    postToNative({ type: "request_location", requestId });
  });
}

export function openNativeAppSettings() {
  if (!canUseNativeLocationBridge()) return false;
  postToNative({ type: "open_settings" });
  return true;
}

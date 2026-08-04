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
  /** GPS timestamp when available — do not invent "now" for cached reads. */
  recordedAt?: string | null;
};

type NativeLocationResult =
  | { requestId: string; ok: true; fix: NativeLocationFix }
  | { requestId: string; ok: false; reason: "denied" | "unavailable" | "error"; message: string };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __MOTIVELIFE_NATIVE_LOCATION__?: boolean;
    __MOTIVELIFE_NATIVE_VERSION__?: string;
    __MOTIVELIFE_NATIVE_BUILD__?: string;
  }
}

export function getNativeAppBuildLabel(): string | null {
  if (typeof window === "undefined") return null;
  const version = window.__MOTIVELIFE_NATIVE_VERSION__;
  const build = window.__MOTIVELIFE_NATIVE_BUILD__;
  if (!version && !build) return null;
  return build ? `${version ?? "?"} (${build})` : String(version);
}

/** Human-readable native location permission line (no version — saves map chrome). */
export async function describeNativeLocationPermission(): Promise<string> {
  if (!canUseNativeLocationBridge()) {
    return "Not in MotiveLife native app (or update needed for live location).";
  }
  const snap = await getNativeLocationPermission();
  if (!snap.ok) {
    return "Could not read location permission status.";
  }
  if (snap.backgroundGranted && snap.servicesOn && snap.foregroundGranted) {
    return ""; // Hide happy-path diag — don’t waste space under the map.
  }
  const scope = snap.iosScope ?? "n/a";
  return `GPS ${snap.servicesOn ? "on" : "OFF"} · app ${
    snap.foregroundGranted ? "allowed" : "NOT allowed"
  } · background ${snap.backgroundGranted ? "Always" : "no"} · iOS scope ${scope}`;
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

type NativeLocationFixOpts = {
  timeoutMs?: number;
  /** When true, never show OS permission dialogs (resume / poll path). */
  silent?: boolean;
};

/** One-shot fix via Expo Location in the native shell. */
export function requestNativeLocationFix(
  timeoutMsOrOpts: number | NativeLocationFixOpts = 18_000
): Promise<NativeLocationResult> {
  const opts =
    typeof timeoutMsOrOpts === "number"
      ? { timeoutMs: timeoutMsOrOpts, silent: false }
      : { timeoutMs: 18_000, silent: false, ...timeoutMsOrOpts };
  const timeoutMs = opts.timeoutMs ?? 18_000;
  const silent = opts.silent === true;

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
    postToNative(
      silent
        ? { type: "read_location", requestId }
        : { type: "request_location", requestId, silent: false }
    );
  });
}

export function openNativeAppSettings() {
  if (!canUseNativeLocationBridge()) return false;
  postToNative({ type: "open_settings" });
  return true;
}

/** Open phone Location/GPS settings (Android LOCATION_SOURCE_SETTINGS). */
export function openNativeLocationSettings() {
  if (!canUseNativeLocationBridge()) return false;
  postToNative({ type: "open_location_settings" });
  return true;
}

type BackgroundLocationResult = {
  requestId: string;
  type?: string;
  ok: boolean;
  backgroundGranted?: boolean;
  iosScope?: "whenInUse" | "always" | "none" | null;
  message: string;
  version?: string;
  build?: string;
};

export type NativeLocationPermissionResult = {
  requestId: string;
  type?: string;
  ok: boolean;
  servicesOn?: boolean;
  foregroundGranted?: boolean;
  backgroundGranted?: boolean;
  iosScope?: "whenInUse" | "always" | "none" | null;
  canAskAgain?: boolean;
  version?: string;
  build?: string;
};

/** Read current native location permission without prompting. */
export function getNativeLocationPermission(
  timeoutMs = 8_000
): Promise<NativeLocationPermissionResult> {
  if (!canUseNativeLocationBridge()) {
    return Promise.resolve({
      requestId: "none",
      ok: false,
      foregroundGranted: false,
      backgroundGranted: false,
    });
  }

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `perm-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NativeLocationPermissionResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("motivelife-location", onEvent as EventListener);
      resolve(result);
    };

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<NativeLocationPermissionResult>).detail;
      if (!detail || detail.requestId !== requestId) return;
      if (detail.type && detail.type !== "location_permission") return;
      finish(detail);
    };

    const timer = window.setTimeout(() => {
      finish({
        requestId,
        ok: false,
        foregroundGranted: false,
        backgroundGranted: false,
      });
    }, timeoutMs);

    window.addEventListener("motivelife-location", onEvent as EventListener);
    postToNative({ type: "get_location_permission", requestId });
  });
}

/** Start Always / background Family location updates in the native shell. */
export function startNativeBackgroundLocation(
  sessionToken: string,
  timeoutMsOrOpts: number | { timeoutMs?: number; promptAlways?: boolean } = 45_000
): Promise<BackgroundLocationResult> {
  const opts =
    typeof timeoutMsOrOpts === "number"
      ? { timeoutMs: timeoutMsOrOpts, promptAlways: false }
      : { timeoutMs: 45_000, promptAlways: false, ...timeoutMsOrOpts };
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const promptAlways = opts.promptAlways === true;

  if (!canUseNativeLocationBridge()) {
    return Promise.resolve({
      requestId: "none",
      ok: false,
      message: "Native location bridge unavailable.",
    });
  }

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `bg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: BackgroundLocationResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("motivelife-location", onEvent as EventListener);
      resolve(result);
    };

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<BackgroundLocationResult>).detail;
      if (!detail || detail.requestId !== requestId) return;
      if (detail.type !== "background_location") return;
      finish(detail);
    };

    const timer = window.setTimeout(() => {
      finish({
        requestId,
        ok: false,
        message: "Background location setup timed out. Try Enable location again.",
      });
    }, timeoutMs);

    window.addEventListener("motivelife-location", onEvent as EventListener);
    postToNative({
      type: "start_background_location",
      requestId,
      sessionToken,
      promptAlways,
    });
  });
}

export function stopNativeBackgroundLocation() {
  if (!canUseNativeLocationBridge()) return false;
  postToNative({ type: "stop_background_location" });
  return true;
}

/** Fetch a JWT the native shell can use for background location POSTs. */
export async function fetchNativeSessionToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/native-session", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

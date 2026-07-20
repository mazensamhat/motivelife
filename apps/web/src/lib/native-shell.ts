/**
 * Detect when the web app is running inside the MotiveLife native shell
 * (Expo / Capacitor WebView). Used for cookie consent, layout chrome, and
 * App Store–safe UI (hide Android / Play references on iOS).
 */

export type NativeShellPlatform = "ios" | "android" | null;

declare global {
  interface Window {
    /** Set by Expo AppShell before the WebView loads (ios | android). */
    __MOTIVELIFE_NATIVE_PLATFORM__?: "ios" | "android";
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

function readInjectedPlatform(): NativeShellPlatform {
  if (typeof window === "undefined") return null;
  const injected = window.__MOTIVELIFE_NATIVE_PLATFORM__;
  if (injected === "ios" || injected === "android") return injected;
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.()) {
      const p = (cap.getPlatform?.() || "").toLowerCase();
      if (p === "ios") return "ios";
      if (p === "android") return "android";
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** True when running inside the Expo / Capacitor WebView shell. */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  if (readInjectedPlatform()) return true;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {
    /* ignore */
  }
  const ua = navigator.userAgent || "";
  // Expo / Capacitor commonly embed a WebView UA hint; keep conservative.
  if (/MotiveLifeNative|Capacitor/i.test(ua)) return true;
  return false;
}

/** "ios" | "android" when inside native shell; null on mobile/desktop browsers. */
export function getNativeShellPlatform(): NativeShellPlatform {
  if (typeof window === "undefined") return null;
  return readInjectedPlatform();
}

export function isNativeIosShell(): boolean {
  return getNativeShellPlatform() === "ios";
}

export function isNativeAndroidShell(): boolean {
  return getNativeShellPlatform() === "android";
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Location from "expo-location";
import {
  ensureAndroidLocationReady,
  fixPayloadFromLocation,
  getFamilyLocationPermissionSnapshot,
  isLikelyAndroidFoldable,
  openSystemLocationSettings,
  promptAndroidLocationSettingsHelp,
  promptIosLocationSettingsHelp,
  readAndroidBestEffortPosition,
  readFamilyLocationFixSilent,
  readNativeSessionToken,
  resumeFamilyBackgroundIfNeeded,
  saveNativeSessionToken,
  settleAfterAndroidUi,
  startFamilyBackgroundLocation,
  stopFamilyBackgroundLocation,
} from "./backgroundLocation";
import { WEB_URL } from "./config";
import {
  configureIap,
  extractTransactionId,
  isIapConfigured,
  purchasePro,
  restorePro,
} from "./iap";
import appJson from "../app.json";
import { isNativeAppleSignInAvailable, signInWithAppleNative } from "./appleAuth";
import { primeIosPrivacyPermissions, requestAllIosPrivacyPermissions } from "./iosPermissions";

const NATIVE_APP_VERSION = appJson.expo.version; // 1.0.15+ silent location resume
const NATIVE_BUILD_NUMBER = String(
  Platform.OS === "ios"
    ? appJson.expo.ios.buildNumber
    : appJson.expo.android.versionCode
);
const NATIVE_APPLE_AUTH = Platform.OS === "ios";

/** Never import react-native-health-connect on iOS — it aborts TurboModules. */
async function runNativeHealthSync(opts: { startDate: string; endDate: string }) {
  if (Platform.OS !== "android") {
    return {
      ok: false as const,
      error: "Health Connect is Android-only.",
    };
  }
  const { syncHealthConnectNative } = await import("./healthConnect");
  return syncHealthConnectNative(opts);
}

const NATIVE_HEALTH_ENABLED = Platform.OS === "android";

/** Lock viewport + mark native shell before paint (platform for App Store 2.3.10). */
const VIEWPORT_LOCK_SCRIPT = `
  (function () {
    try {
      document.documentElement.classList.add("motivelife-native-shell");
      window.__MOTIVELIFE_NATIVE_PLATFORM__ = ${JSON.stringify(Platform.OS === "ios" ? "ios" : "android")};
      window.__MOTIVELIFE_NATIVE_IAP__ = ${isIapConfigured() ? "true" : "false"};
      window.__MOTIVELIFE_NATIVE_HEALTH__ = ${NATIVE_HEALTH_ENABLED ? "true" : "false"};
      window.__MOTIVELIFE_NATIVE_LOCATION__ = true;
      window.__MOTIVELIFE_NATIVE_APPLE_AUTH__ = ${NATIVE_APPLE_AUTH ? "true" : "false"};
      window.__MOTIVELIFE_NATIVE_VERSION__ = ${JSON.stringify(NATIVE_APP_VERSION)};
      window.__MOTIVELIFE_NATIVE_BUILD__ = ${JSON.stringify(NATIVE_BUILD_NUMBER)};
      var content = "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover";
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "viewport");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
      // Drop stale PWA shells so Family Map UI updates land after a soft refresh.
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (reg) { reg.unregister(); });
        });
      }
    } catch (e) {}
    true;
  })();
`;

/** Re-assert shell flags after redirects / SPA navigations (esp. iOS session restore). */
const NATIVE_SHELL_REINJECT_SCRIPT = `
  (function () {
    try {
      document.documentElement.classList.add("motivelife-native-shell");
      window.__MOTIVELIFE_NATIVE_PLATFORM__ = ${JSON.stringify(Platform.OS === "ios" ? "ios" : "android")};
      window.__MOTIVELIFE_NATIVE_LOCATION__ = true;
      window.__MOTIVELIFE_NATIVE_IAP__ = ${isIapConfigured() ? "true" : "false"};
      window.__MOTIVELIFE_NATIVE_HEALTH__ = ${NATIVE_HEALTH_ENABLED ? "true" : "false"};
      window.__MOTIVELIFE_NATIVE_APPLE_AUTH__ = ${NATIVE_APPLE_AUTH ? "true" : "false"};
      window.__MOTIVELIFE_NATIVE_VERSION__ = ${JSON.stringify(NATIVE_APP_VERSION)};
      window.__MOTIVELIFE_NATIVE_BUILD__ = ${JSON.stringify(NATIVE_BUILD_NUMBER)};
    } catch (e) {}
    true;
  })();
`;

const HARD_RELOAD_SCRIPT = `
  (async function () {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < regs.length; i++) await regs[i].unregister();
      }
      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }
    } catch (e) {}
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("_ml", String(Date.now()));
      window.location.replace(u.toString());
    } catch (e2) {
      window.location.reload();
    }
    true;
  })();
`;

type NativeMsg =
  | { type: "iap_purchase"; userId?: string }
  | { type: "iap_restore"; userId?: string }
  | { type: "session"; userId?: string; sessionToken?: string }
  | {
      type: "health_connect_sync";
      requestId: string;
      startDate?: string;
      endDate?: string;
    }
  | { type: "request_location"; requestId: string; silent?: boolean }
  | { type: "read_location"; requestId: string }
  | { type: "get_location_permission"; requestId: string }
  | {
      type: "start_background_location";
      requestId: string;
      sessionToken: string;
      promptAlways?: boolean;
    }
  | { type: "stop_background_location"; requestId?: string }
  | { type: "open_settings" }
  | { type: "open_location_settings" }
  | { type: "apple_sign_in"; requestId: string }
  | { type: "request_privacy_permissions"; requestId?: string };

export function AppShell() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  /** Remount WebView after Android render-process death (common on Z Fold). */
  const [webKey, setWebKey] = useState(0);
  const remountAtRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iapBusy, setIapBusy] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [iapBanner, setIapBanner] = useState<string | null>(null);
  const appUserIdRef = useRef<string | null>(null);
  const locationBusyRef = useRef(false);
  const [locBanner, setLocBanner] = useState<string | null>(null);
  const [locBannerOk, setLocBannerOk] = useState(false);
  const [locBannerDismissed, setLocBannerDismissed] = useState(false);
  /** iOS: wait until we've decided whether to bootstrap from SecureStore JWT. */
  const [bootSource, setBootSource] = useState<{
    uri: string;
    headers?: Record<string, string>;
  } | null>(Platform.OS === "ios" ? null : { uri: WEB_URL });

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    (async () => {
      const token = await readNativeSessionToken();
      if (cancelled) return;
      if (token) {
        // First document request carries the JWT; restore route sets the cookie
        // then redirects into the app. Avoids WKWebView cookie-loss on kill.
        setBootSource({
          uri: `${WEB_URL.replace(/\/$/, "")}/api/auth/native-session/restore?next=${encodeURIComponent("/dashboard")}`,
          headers: {
            "X-MotiveLife-Session": token,
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        setBootSource({ uri: WEB_URL });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLocBanner = useCallback(async () => {
    try {
      const snap = await getFamilyLocationPermissionSnapshot();
      if (snap.backgroundGranted) {
        // Always-on is the happy path — don’t waste bottom screen space.
        setLocBannerOk(true);
        setLocBanner(null);
        return;
      }
      setLocBannerOk(false);
      setLocBannerDismissed(false);
      const line =
        Platform.OS === "ios"
          ? "Set Location to Always — tracking stops when MotiveLife is closed without it"
          : `Location needs Always · GPS ${
              snap.servicesOn ? "on" : "OFF"
            } · app ${snap.foregroundGranted ? "OK" : "NO"}`;
      setLocBanner(line);
    } catch {
      setLocBannerOk(false);
      setLocBanner("Location status unavailable — tap to fix permissions");
    }
  }, []);

  useEffect(() => {
    if (!locBannerOk || locBannerDismissed) return;
    const t = setTimeout(() => setLocBannerDismissed(true), 8_000);
    return () => clearTimeout(t);
  }, [locBannerOk, locBannerDismissed]);

  useEffect(() => {
    void configureIap().catch(() => {
      // Missing RevenueCat key must never crash App Review launch.
    });
  }, []);

  // iOS: request privacy APIs as soon as the shell mounts — do not wait for
  // WebView load. Info.plist alone never creates Settings → MotiveLife rows.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const t = setTimeout(() => {
      void primeIosPrivacyPermissions();
      void isNativeAppleSignInAvailable().catch(() => undefined);
    }, 450);
    return () => clearTimeout(t);
  }, []);

  // Keep a late retry after first paint in case the early request raced
  // SecureStore / Activity resume.
  useEffect(() => {
    if (Platform.OS !== "ios" || !initialLoadDone) return;
    const t = setTimeout(() => {
      void primeIosPrivacyPermissions();
    }, 1200);
    return () => clearTimeout(t);
  }, [initialLoadDone]);

  useEffect(() => {
    void refreshLocBanner();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshLocBanner();
        // Re-arm iOS Always / Android poll when returning from background.
        void resumeFamilyBackgroundIfNeeded();
      }
    });
    return () => sub.remove();
  }, [refreshLocBanner]);

  // Cold start: if Share Live was left on, re-arm the iOS Always location task
  // immediately — don't wait for the WebView to ask.
  useEffect(() => {
    const t = setTimeout(() => {
      void resumeFamilyBackgroundIfNeeded();
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // Heartbeat: if iOS killed the task while Share Live is still on, soft-start
  // again. Never force-restarts a healthy Always session.
  useEffect(() => {
    const id = setInterval(() => {
      if (AppState.currentState !== "active") return;
      void resumeFamilyBackgroundIfNeeded();
    }, 45_000);
    return () => clearInterval(id);
  }, []);

  // Never leave the cyan overlay stuck if onLoadEnd is missed
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoading(false);
      setInitialLoadDone(true);
    }, 12_000);
    return () => clearTimeout(t);
  }, [loading]);

  const remountWebView = useCallback(() => {
    // Debounce rapid Android render-process death callbacks (common on Fold).
    const now = Date.now();
    if (now - (remountAtRef.current || 0) < 1500) return;
    remountAtRef.current = now;
    setError(null);
    setLoading(true);
    setInitialLoadDone(false);
    setWebKey((k) => k + 1);
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    setInitialLoadDone(false);
    // Hard reload: clear SW/HTTP shell cache, then navigate with a bust param.
    // Soft WebView.reload() often keeps stale Family Map chunks on iOS.
    if (webRef.current) {
      webRef.current.injectJavaScript(HARD_RELOAD_SCRIPT);
    } else {
      remountWebView();
    }
  }, [remountWebView]);

  const notifyWeb = useCallback((payload: Record<string, unknown>) => {
    const js = `
      (function(){
        try {
          window.dispatchEvent(new CustomEvent("motivelife-iap", { detail: ${JSON.stringify(payload)} }));
        } catch (e) {}
        true;
      })();
    `;
    webRef.current?.injectJavaScript(js);
  }, []);

  const notifyHealthWeb = useCallback((payload: Record<string, unknown>) => {
    const js = `
      (function(){
        try {
          window.dispatchEvent(new CustomEvent("motivelife-health", { detail: ${JSON.stringify(payload)} }));
        } catch (e) {}
        true;
      })();
    `;
    webRef.current?.injectJavaScript(js);
  }, []);

  const notifyAuthWeb = useCallback((payload: Record<string, unknown>) => {
    const js = `
      (function(){
        try {
          window.dispatchEvent(new CustomEvent("motivelife-auth", { detail: ${JSON.stringify(payload)} }));
        } catch (e) {}
        true;
      })();
    `;
    webRef.current?.injectJavaScript(js);
  }, []);

  /** Complete Apple sign-in inside the WebView so session cookies stick. */
  const completeAppleSignInInWebView = useCallback(
    (opts: {
      identityToken: string;
      email: string | null;
      fullName: string | null;
      mode?: string;
      plan?: string | null;
      familyInviteCode?: string | null;
      partnerInviteCode?: string | null;
      referralCode?: string | null;
      legalAccepted?: boolean;
    }) => {
      const js = `
        (async function () {
          try {
            var res = await fetch("/api/auth/apple/id-token", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(${JSON.stringify({
                identityToken: opts.identityToken,
                email: opts.email,
                fullName: opts.fullName,
                mode: opts.mode === "register" ? "register" : "login",
                plan: opts.plan || undefined,
                familyInviteCode: opts.familyInviteCode || undefined,
                partnerInviteCode: opts.partnerInviteCode || undefined,
                referralCode: opts.referralCode || undefined,
                legalAccepted: opts.legalAccepted,
              })}),
            });
            var body = await res.json().catch(function () { return {}; });
            if (!res.ok) {
              var err = (body && body.error) ? body.error : "Couldn’t complete Apple sign-in.";
              window.location.href = "/login?oauth_error=apple_failed&msg=" + encodeURIComponent(err);
              return;
            }
            try {
              var sess = await fetch("/api/auth/native-session", { credentials: "include" });
              if (sess.ok && window.ReactNativeWebView) {
                var sessBody = await sess.json();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: "session",
                  userId: sessBody.userId,
                  sessionToken: sessBody.token
                }));
              }
            } catch (e2) {}
            window.location.href = (body && body.redirectTo) ? body.redirectTo : "/dashboard";
          } catch (e) {
            window.location.href = "/login?oauth_error=apple_failed";
          }
          true;
        })();
      `;
      webRef.current?.injectJavaScript(js);
    },
    []
  );

  const runNativeAppleSignIn = useCallback(
    async (requestId?: string, startParams?: URLSearchParams) => {
      const result = await signInWithAppleNative();
      if (requestId) {
        notifyAuthWeb({
          type: "apple_sign_in",
          requestId,
          ok: result.ok,
          cancelled: !result.ok && Boolean(result.cancelled),
          identityToken: result.ok ? result.identityToken : undefined,
          email: result.ok ? result.email : null,
          fullName: result.ok ? result.fullName : null,
          message: result.ok ? "ok" : result.message,
        });
      }
      // Intercept path (no requestId from web bridge): finish session in WebView.
      if (!requestId && result.ok) {
        completeAppleSignInInWebView({
          identityToken: result.identityToken,
          email: result.email,
          fullName: result.fullName,
          mode: startParams?.get("mode") || "login",
          plan: startParams?.get("plan"),
          familyInviteCode: startParams?.get("family"),
          partnerInviteCode: startParams?.get("partner"),
          referralCode: startParams?.get("ref"),
          legalAccepted: startParams?.get("legal") === "1",
        });
      } else if (!requestId && !result.ok && result.cancelled) {
        // Stay on login — user dismissed the sheet.
      } else if (!requestId && !result.ok) {
        const msg = encodeURIComponent(result.message || "apple_failed");
        webRef.current?.injectJavaScript(
          `window.location.href = "/login?oauth_error=apple_failed&msg=${msg}"; true;`
        );
      }
      return result;
    },
    [completeAppleSignInInWebView, notifyAuthWeb]
  );

  const notifyLocationWeb = useCallback((payload: Record<string, unknown>) => {
    const js = `
      (function(){
        try {
          window.dispatchEvent(new CustomEvent("motivelife-location", { detail: ${JSON.stringify(payload)} }));
        } catch (e) {}
        true;
      })();
    `;
    webRef.current?.injectJavaScript(js);
  }, []);

  const runNativeLocation = useCallback(
    async (requestId: string, opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (locationBusyRef.current) {
        notifyLocationWeb({
          requestId,
          ok: false,
          reason: "error",
          message: "Location request already in progress. Try again in a moment.",
        });
        return;
      }
      locationBusyRef.current = true;
      try {
        if (silent) {
          const silentResult = await readFamilyLocationFixSilent();
          if (!silentResult.ok) {
            notifyLocationWeb({
              requestId,
              ok: false,
              reason: silentResult.reason,
              message: silentResult.message,
            });
            return;
          }
          notifyLocationWeb({
            requestId,
            ok: true,
            fix: silentResult.fix,
          });
          return;
        }

        if (Platform.OS === "android") {
          // Request app Location permission first (so it appears in App Settings),
          // then prompt to turn on the phone Location/GPS toggle.
          const ready = await ensureAndroidLocationReady({ prompt: true });
          if (!ready.ok) {
            notifyLocationWeb({
              requestId,
              ok: false,
              reason: ready.foregroundGranted ? "unavailable" : "denied",
              message: ready.message,
            });
            return;
          }
          // Fold: never call getCurrentPosition right after the permission sheet.
          await settleAfterAndroidUi(isLikelyAndroidFoldable() ? 1200 : 600);
        } else {
          const servicesOn = await Location.hasServicesEnabledAsync();
          if (!servicesOn) {
            notifyLocationWeb({
              requestId,
              ok: false,
              reason: "unavailable",
              message:
                "Location Services are off. Open iPhone Settings → Privacy & Security → Location Services → On, then try again.",
            });
            return;
          }

          const current = await Location.getForegroundPermissionsAsync();
          let status = current.status;
          // Prompt only when not already granted (user tap path).
          if (status !== Location.PermissionStatus.GRANTED) {
            const asked = await Location.requestForegroundPermissionsAsync();
            status = asked.status;
          }
          if (status !== Location.PermissionStatus.GRANTED) {
            notifyLocationWeb({
              requestId,
              ok: false,
              reason: "denied",
              message:
                'Location is not allowed yet. Tap Enable location again and choose “Allow While Using App” — not “When I Share”. Then we’ll ask for Always.',
            });
            return;
          }
        }

        // Do NOT request Always here — iOS drops the Always dialog if it races
        // with getCurrentPosition. Always is requested only via start_background_location.

        // Prefer a fresh GPS read on iOS; Android uses Fold-safe best-effort last-known.
        const androidSafe = Platform.OS === "android";
        const readFix = async () => {
          try {
            if (androidSafe) {
              // Never getCurrentPosition on Fold. Accept older last-known for the
              // pin — speedKmhFromLocation already zeros stale Doppler speed.
              return await readAndroidBestEffortPosition({
                timeoutMs: 18_000,
                allowFreshRead: !isLikelyAndroidFoldable(),
              });
            }
            return await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              mayShowUserSettingsDialog: false,
            });
          } catch {
            if (androidSafe) {
              return await readAndroidBestEffortPosition({
                timeoutMs: 4_000,
                allowFreshRead: false,
              });
            }
            return await Location.getLastKnownPositionAsync({
              maxAge: 15_000,
              requiredAccuracy: 80,
            });
          }
        };

        const pos = await Promise.race([
          readFix(),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), androidSafe ? 22_000 : 12_000);
          }),
        ]);

        if (!pos) {
          notifyLocationWeb({
            requestId,
            ok: false,
            reason: "error",
            message: androidSafe
              ? "Location is allowed, but Android has not cached a GPS pin yet. Keep MotiveLife open with Location (GPS) on for ~15 seconds, step near a window if you can, then tap Allow location again."
              : 'GPS timed out. In Settings → MotiveLife → Location, switch off “Ask Next Time Or When I Share”, choose While Using the App, then tap Enable location again.',
          });
          return;
        }
        notifyLocationWeb({
          requestId,
          ok: true,
          fix: fixPayloadFromLocation(pos),
        });
      } catch (e) {
        notifyLocationWeb({
          requestId,
          ok: false,
          reason: "error",
          message: e instanceof Error ? e.message : "Could not get location.",
        });
      } finally {
        locationBusyRef.current = false;
      }
    },
    [notifyLocationWeb]
  );

  const runHealthConnectSync = useCallback(
    async (msg: {
      requestId: string;
      startDate?: string;
      endDate?: string;
    }) => {
      if (healthBusy) return;
      setHealthBusy(true);
      try {
        const start =
          msg.startDate ??
          (() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
          })();
        const end = msg.endDate ?? new Date().toISOString();
        const result = await runNativeHealthSync({ startDate: start, endDate: end });
        if (!result.ok) {
          notifyHealthWeb({
            requestId: msg.requestId,
            ok: false,
            error: result.error,
          });
          return;
        }
        notifyHealthWeb({
          requestId: msg.requestId,
          ok: true,
          metrics: result.metrics,
        });
      } catch (e) {
        notifyHealthWeb({
          requestId: msg.requestId,
          ok: false,
          error: e instanceof Error ? e.message : "Health Connect sync failed.",
        });
      } finally {
        setHealthBusy(false);
      }
    },
    [healthBusy, notifyHealthWeb]
  );

  const runPurchase = useCallback(
    async (userId?: string) => {
      if (iapBusy) return;
      setIapBusy(true);
      setIapBanner(null);
      try {
        if (userId) {
          appUserIdRef.current = userId;
          await configureIap(userId);
        }
        const result = await purchasePro();
        if (!result.ok || !result.customerInfo) {
          setIapBanner(result.error ?? "Purchase failed.");
          notifyWeb({ type: "iap_result", ok: false, error: result.error });
          return;
        }
        const tx =
          extractTransactionId(result.customerInfo) ??
          result.originalTransactionId ??
          `rc:${appUserIdRef.current ?? "anon"}:${result.productId ?? "pro"}`;
        // Prefer syncing from WebView context (session cookie) via injected fetch.
        const syncJs = `
          (async function(){
            try {
              var res = await fetch("/api/subscription/apple", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  action: "activate",
                  originalTransactionId: ${JSON.stringify(tx)},
                  productId: ${JSON.stringify(result.productId ?? null)},
                  revenueCatAppUserId: ${JSON.stringify(appUserIdRef.current)},
                  entitlementActive: true
                })
              });
              window.dispatchEvent(new CustomEvent("motivelife-iap", {
                detail: { type: "iap_result", ok: res.ok }
              }));
              if (res.ok) window.location.reload();
            } catch (e) {
              window.dispatchEvent(new CustomEvent("motivelife-iap", {
                detail: { type: "iap_result", ok: false, error: String(e) }
              }));
            }
            true;
          })();
        `;
        webRef.current?.injectJavaScript(syncJs);
        setIapBanner("MyMotiveLife Pro unlocked.");
      } finally {
        setIapBusy(false);
      }
    },
    [iapBusy, notifyWeb]
  );

  const runRestore = useCallback(
    async (userId?: string) => {
      if (iapBusy) return;
      setIapBusy(true);
      setIapBanner(null);
      try {
        if (userId) await configureIap(userId);
        const result = await restorePro();
        if (!result.ok || !result.customerInfo) {
          setIapBanner(result.error ?? "Restore failed.");
          return;
        }
        const tx =
          extractTransactionId(result.customerInfo) ??
          result.originalTransactionId ??
          `rc:restore:${result.productId ?? "pro"}`;
        const syncJs = `
          (async function(){
            try {
              await fetch("/api/subscription/apple", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  action: "activate",
                  originalTransactionId: ${JSON.stringify(tx)},
                  productId: ${JSON.stringify(result.productId ?? null)},
                  entitlementActive: true
                })
              });
              window.location.reload();
            } catch (e) {}
            true;
          })();
        `;
        webRef.current?.injectJavaScript(syncJs);
        setIapBanner("Purchases restored.");
      } finally {
        setIapBusy(false);
      }
    },
    [iapBusy]
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as NativeMsg;
        if (data.type === "session" && data.userId) {
          appUserIdRef.current = data.userId;
          void configureIap(data.userId);
          if (typeof data.sessionToken === "string" && data.sessionToken.length > 20) {
            void saveNativeSessionToken(data.sessionToken);
          }
          return;
        }
        if (data.type === "iap_purchase") {
          void runPurchase(data.userId);
          return;
        }
        if (data.type === "iap_restore") {
          void runRestore(data.userId);
          return;
        }
        if (data.type === "health_connect_sync" && data.requestId) {
          void runHealthConnectSync(data);
          return;
        }
        if (
          (data.type === "request_location" || data.type === "read_location") &&
          data.requestId
        ) {
          void runNativeLocation(data.requestId, {
            silent: data.type === "read_location" || data.silent === true,
          });
          return;
        }
        if (data.type === "get_location_permission" && data.requestId) {
          void (async () => {
            try {
              const snap = await getFamilyLocationPermissionSnapshot();
              notifyLocationWeb({
                requestId: data.requestId,
                type: "location_permission",
                ok: true,
                ...snap,
                version: NATIVE_APP_VERSION,
                build: NATIVE_BUILD_NUMBER,
              });
            } catch {
              notifyLocationWeb({
                requestId: data.requestId,
                type: "location_permission",
                ok: false,
                foregroundGranted: false,
                backgroundGranted: false,
              });
            }
          })();
          return;
        }
        if (data.type === "start_background_location" && data.requestId && data.sessionToken) {
          void (async () => {
            const result = await startFamilyBackgroundLocation(data.sessionToken, {
              promptAlways: data.promptAlways === true,
            });
            notifyLocationWeb({
              requestId: data.requestId,
              type: "background_location",
              ok: result.ok,
              backgroundGranted: result.backgroundGranted,
              iosScope: result.iosScope,
              message: result.message,
              version: NATIVE_APP_VERSION,
              build: NATIVE_BUILD_NUMBER,
            });
            void refreshLocBanner();
          })();
          return;
        }
        if (data.type === "stop_background_location") {
          void stopFamilyBackgroundLocation().then(() => {
            if (data.requestId) {
              notifyLocationWeb({
                requestId: data.requestId,
                type: "background_location",
                ok: true,
                backgroundGranted: false,
                message: "Background location sharing stopped.",
              });
            }
          });
          return;
        }
        if (data.type === "open_settings") {
          void (async () => {
            // iOS only lists Location under the app after a permission prompt.
            if (Platform.OS === "ios") {
              try {
                const fg = await Location.getForegroundPermissionsAsync();
                if (
                  fg.status !== Location.PermissionStatus.GRANTED &&
                  fg.canAskAgain !== false
                ) {
                  await Location.requestForegroundPermissionsAsync();
                }
              } catch {
                // still open Settings
              }
            }
            await Linking.openSettings();
          })();
          return;
        }
        if (data.type === "open_location_settings") {
          void openSystemLocationSettings();
          return;
        }
        if (data.type === "apple_sign_in" && data.requestId) {
          void runNativeAppleSignIn(data.requestId);
          return;
        }
        if (data.type === "request_privacy_permissions") {
          void (async () => {
            if (Platform.OS !== "ios") return;
            const result = await requestAllIosPrivacyPermissions();
            if (data.requestId) {
              notifyAuthWeb({
                type: "privacy_permissions",
                requestId: data.requestId,
                ok: true,
                ...result,
              });
            }
            void refreshLocBanner();
          })();
        }
      } catch {
        // ignore malformed messages
      }
    },
    [
      runPurchase,
      runRestore,
      runHealthConnectSync,
      runNativeLocation,
      notifyLocationWeb,
      refreshLocBanner,
      runNativeAppleSignIn,
      notifyAuthWeb,
    ]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load MotiveLife</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retry} onPress={reload}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : !bootSource ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#00c6ff" />
        </View>
      ) : (
        <>
          <WebView
            key={webKey}
            ref={webRef}
            source={bootSource}
            style={styles.webview}
            originWhitelist={["https://*", "http://*"]}
            allowsBackForwardNavigationGestures
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled={Platform.OS === "ios"}
            // iOS: keep cache on so WKWebView can persist cookies across kills.
            // Android Fold: disable cache to avoid stale PWA shells after remounts.
            cacheEnabled={Platform.OS === "ios"}
            startInLoadingState={!initialLoadDone}
            // Reduce dual-scroll rubber-banding against the dashboard <main> scroller.
            bounces={false}
            overScrollMode="never"
            // Fold GPU WebView deaths: software layer only on likely foldables.
            // Other Android devices keep hardware for smoother scrolling.
            {...(Platform.OS === "android"
              ? ({
                  androidLayerType: isLikelyAndroidFoldable()
                    ? "software"
                    : "hardware",
                } as object)
              : {})}
            injectedJavaScriptBeforeContentLoaded={VIEWPORT_LOCK_SCRIPT}
            injectedJavaScript={NATIVE_SHELL_REINJECT_SCRIPT}
            onMessage={onMessage}
            onShouldStartLoadWithRequest={(req) => {
              // WKWebView cannot complete Apple's web OAuth (form_post). Intercept
              // and run native Sign in with Apple instead — works even before web deploy.
              if (Platform.OS !== "ios") return true;
              const url = req.url || "";
              if (
                url.includes("/api/auth/apple/start") ||
                url.includes("appleid.apple.com/auth/authorize")
              ) {
                let params = new URLSearchParams();
                try {
                  params = new URL(url).searchParams;
                } catch {
                  // ignore
                }
                void runNativeAppleSignIn(undefined, params);
                return false;
              }
              return true;
            }}
            onLoadStart={() => {
              // Only show the cyan overlay on the first load — SPA navigations
              // were leaving a stuck spinner over Family Map.
              if (!initialLoadDone) setLoading(true);
            }}
            onLoadEnd={() => {
              setLoading(false);
              setInitialLoadDone(true);
              // Reinforces flags after iOS session-restore redirects.
              webRef.current?.injectJavaScript(NATIVE_SHELL_REINJECT_SCRIPT);
            }}
            onError={(e) => {
              setLoading(false);
              setInitialLoadDone(true);
              setError(e.nativeEvent.description || "Network error");
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 500) {
                setError(`Server error (${e.nativeEvent.statusCode})`);
              }
            }}
            // Z Fold / Android: WebView GPU process often dies after location
            // permission / settings — remount instead of killing the app.
            onRenderProcessGone={(e) => {
              console.warn(
                "[AppShell] WebView render process gone",
                e.nativeEvent?.didCrash ? "crash" : "killed"
              );
              // Remounting during a location permission flow can cascade-crash Fold.
              if (locationBusyRef.current) {
                return true;
              }
              remountWebView();
              return true;
            }}
            onContentProcessDidTerminate={() => {
              console.warn("[AppShell] WebView content process terminated");
              remountWebView();
            }}
            // Android: keep WebView geolocation OFF — Family Map uses the native
            // expo-location bridge. Dual GPS stacks crash Z Fold after Allow.
            {...(Platform.OS === "android"
              ? ({ geolocationEnabled: false } as object)
              : ({
                  geolocationEnabled: true,
                  onGeolocationPermissionsShowPrompt: (
                    _origin: string,
                    callback: (grant: boolean, retain: boolean) => void
                  ) => {
                    callback(true, true);
                  },
                } as object))}
          />
          {loading && !initialLoadDone && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#00c6ff" />
            </View>
          )}
          {(iapBusy || healthBusy) && (
            <View style={styles.iapOverlay}>
              <ActivityIndicator size="large" color="#00c6ff" />
              <Text style={styles.iapText}>
                {healthBusy ? "Syncing health data…" : "Opening App Store…"}
              </Text>
            </View>
          )}
          {iapBanner && !iapBusy && !healthBusy && (
            <Pressable style={styles.banner} onPress={() => setIapBanner(null)}>
              <Text style={styles.bannerText}>{iapBanner}</Text>
            </Pressable>
          )}
          {locBanner && !locBannerDismissed ? (
            <Pressable
              style={styles.locBanner}
              onPress={() => {
                if (locBannerOk) {
                  setLocBannerDismissed(true);
                  return;
                }
                if (Platform.OS === "ios") {
                  promptIosLocationSettingsHelp("always");
                } else {
                  promptAndroidLocationSettingsHelp("app");
                }
                void refreshLocBanner();
              }}
            >
              <Text style={styles.locBannerText}>{locBanner}</Text>
              <Text style={styles.locBannerAction}>
                {locBannerOk
                  ? "Tap to dismiss"
                  : Platform.OS === "ios"
                    ? "Tap: open Settings → set Location to Always"
                    : "Tap: fix Location permission / GPS"}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050d18",
  },
  webview: {
    flex: 1,
    backgroundColor: "#050d18",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5, 13, 24, 0.55)",
  },
  iapOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5, 13, 24, 0.72)",
    gap: 12,
  },
  iapText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 198, 255, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    color: "#041018",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  locBanner: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
    backgroundColor: "rgba(5, 13, 24, 0.94)",
    borderColor: "rgba(0, 198, 255, 0.45)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locBannerText: {
    color: "#b8e9ff",
    fontSize: 10,
    textAlign: "center",
  },
  locBannerAction: {
    marginTop: 3,
    color: "#00c6ff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorBody: {
    color: "#a8b8d4",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  retry: {
    backgroundColor: "#00c6ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: "#041018",
    fontWeight: "700",
  },
});

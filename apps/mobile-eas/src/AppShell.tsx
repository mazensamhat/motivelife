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
  getFamilyLocationPermissionSnapshot,
  openSystemLocationSettings,
  promptAndroidLocationSettingsHelp,
  promptIosLocationSettingsHelp,
  readFamilyLocationFixSilent,
  startFamilyBackgroundLocation,
  stopFamilyBackgroundLocation,
} from "./backgroundLocation";
import { registerFamilyPushToken } from "./pushNotifications";
import { WEB_URL } from "./config";
import {
  configureIap,
  extractTransactionId,
  isIapConfigured,
  purchasePro,
  restorePro,
} from "./iap";
import appJson from "../app.json";

const NATIVE_APP_VERSION = appJson.expo.version; // 1.0.15+ silent location resume
const NATIVE_BUILD_NUMBER = String(
  Platform.OS === "ios"
    ? appJson.expo.ios.buildNumber
    : appJson.expo.android.versionCode
);

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
  | { type: "session"; userId?: string }
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
  | { type: "open_location_settings" };

export function AppShell() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  /** Remount WebView after Android render-process death (common on Z Fold unfold). */
  const [webKey, setWebKey] = useState(0);
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

  const refreshLocBanner = useCallback(async () => {
    try {
      const snap = await getFamilyLocationPermissionSnapshot();
      if (snap.backgroundGranted) {
        setLocBannerOk(true);
        // Brief confirmation, then auto-clear so it doesn’t block the Family sheet.
        setLocBanner(`v${NATIVE_APP_VERSION} (${NATIVE_BUILD_NUMBER}) · Always location ON`);
        return;
      }
      setLocBannerOk(false);
      setLocBannerDismissed(false);
      const scope = snap.iosScope ?? (Platform.OS === "android" ? "android" : "none");
      const line = `v${NATIVE_APP_VERSION} (${NATIVE_BUILD_NUMBER}) · GPS ${
        snap.servicesOn ? "on" : "OFF"
      } · app ${snap.foregroundGranted ? "OK" : "NO"} · Always NO · scope ${scope}`;
      setLocBanner(line);
    } catch {
      setLocBannerOk(false);
      setLocBanner(`v${NATIVE_APP_VERSION} (${NATIVE_BUILD_NUMBER}) · location status unavailable`);
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

  useEffect(() => {
    void refreshLocBanner();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshLocBanner();
    });
    return () => sub.remove();
  }, [refreshLocBanner]);

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

        // Prefer a fresh GPS read; last-known only as a tight fallback.
        const readFix = async () => {
          try {
            return await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              mayShowUserSettingsDialog: false,
            });
          } catch {
            return await Location.getLastKnownPositionAsync({
              maxAge: 15_000,
              requiredAccuracy: 80,
            });
          }
        };

        const pos = await Promise.race([
          readFix(),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 12_000);
          }),
        ]);

        if (!pos) {
          notifyLocationWeb({
            requestId,
            ok: false,
            reason: "error",
            message:
              Platform.OS === "ios"
                ? 'GPS timed out. In Settings → MotiveLife → Location, switch off “Ask Next Time Or When I Share”, choose While Using the App, then tap Enable location again.'
                : "GPS timed out. Make sure Location is on for MotiveLife, step outside or near a window, then try again.",
          });
          return;
        }
        const speedMs = pos.coords.speed;
        notifyLocationWeb({
          requestId,
          ok: true,
          fix: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy ?? null,
            speedKmh:
              speedMs != null && speedMs >= 0 ? Math.round(speedMs * 3.6 * 10) / 10 : null,
            headingDeg:
              pos.coords.heading != null && pos.coords.heading >= 0
                ? pos.coords.heading
                : null,
            recordedAt: new Date(pos.timestamp).toISOString(),
          },
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
            // Life360-parity: register Expo push when Always location starts.
            void registerFamilyPushToken({
              sessionToken: data.sessionToken,
              appVersion: NATIVE_APP_VERSION,
            });
            void refreshLocBanner();
          })();
          return;
        }
        if (data.type === "register_push" && data.sessionToken) {
          void registerFamilyPushToken({
            sessionToken: data.sessionToken,
            appVersion: NATIVE_APP_VERSION,
          }).then((result) => {
            if (data.requestId) {
              notifyLocationWeb({
                requestId: data.requestId,
                type: "push_register",
                ok: result.ok,
                message: result.message,
              });
            }
          });
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
          void Linking.openSettings();
          return;
        }
        if (data.type === "open_location_settings") {
          void openSystemLocationSettings();
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
      ) : (
        <>
          <WebView
            key={webKey}
            ref={webRef}
            source={{ uri: WEB_URL }}
            style={styles.webview}
            originWhitelist={["https://*", "http://*"]}
            allowsBackForwardNavigationGestures
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled={false}
            cacheEnabled={false}
            startInLoadingState={!initialLoadDone}
            injectedJavaScriptBeforeContentLoaded={VIEWPORT_LOCK_SCRIPT}
            onMessage={onMessage}
            onLoadStart={() => {
              // Only show the cyan overlay on the first load — SPA navigations
              // were leaving a stuck spinner over Family Map.
              if (!initialLoadDone) setLoading(true);
            }}
            onLoadEnd={() => {
              setLoading(false);
              setInitialLoadDone(true);
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
            // Z Fold / Android: WebView GPU process often dies on unfold — remount, don't crash the app.
            onRenderProcessGone={(e) => {
              console.warn(
                "[AppShell] WebView render process gone",
                e.nativeEvent?.didCrash ? "crash" : "killed"
              );
              remountWebView();
              return true;
            }}
            // iOS equivalent of render-process death
            onContentProcessDidTerminate={() => {
              console.warn("[AppShell] WebView content process terminated");
              remountWebView();
            }}
            // Android WebView geolocation — types lag the runtime props
            {...({
              geolocationEnabled: true,
              onGeolocationPermissionsShowPrompt: (
                _origin: string,
                callback: (grant: boolean, retain: boolean) => void
              ) => {
                // Grant + retain so WebView geolocation stays allowed for Family Map.
                callback(true, true);
              },
            } as object)}
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

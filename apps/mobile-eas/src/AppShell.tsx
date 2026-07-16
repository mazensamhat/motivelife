import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { WEB_URL } from "./config";
import { syncHealthConnectNative } from "./healthConnect";
import {
  configureIap,
  extractTransactionId,
  isIapConfigured,
  purchasePro,
  restorePro,
} from "./iap";

const NATIVE_HEALTH_ENABLED = Platform.OS === "android";

/** Lock viewport + mark native shell before paint. */
const VIEWPORT_LOCK_SCRIPT = `
  (function () {
    try {
      document.documentElement.classList.add("motivelife-native-shell");
      window.__MOTIVELIFE_NATIVE_IAP__ = ${isIapConfigured() ? "true" : "false"};
      window.__MOTIVELIFE_NATIVE_HEALTH__ = ${NATIVE_HEALTH_ENABLED ? "true" : "false"};
      var content = "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover";
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "viewport");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    } catch (e) {}
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
    };

export function AppShell() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iapBusy, setIapBusy] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [iapBanner, setIapBanner] = useState<string | null>(null);
  const appUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    void configureIap();
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

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
        const result = await syncHealthConnectNative({ startDate: start, endDate: end });
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
        setIapBanner("MotiveLife Pro unlocked.");
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
        }
      } catch {
        // ignore malformed messages
      }
    },
    [runPurchase, runRestore, runHealthConnectSync]
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
            thirdPartyCookiesEnabled
            startInLoadingState
            injectedJavaScriptBeforeContentLoaded={VIEWPORT_LOCK_SCRIPT}
            onMessage={onMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              setError(e.nativeEvent.description || "Network error");
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 500) {
                setError(`Server error (${e.nativeEvent.statusCode})`);
              }
            }}
          />
          {loading && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#00c6ff" />
            </View>
          )}
          {(iapBusy || healthBusy) && (
            <View style={styles.iapOverlay}>
              <ActivityIndicator size="large" color="#00c6ff" />
              <Text style={styles.iapText}>
                {healthBusy ? "Syncing Health Connect…" : "Opening App Store…"}
              </Text>
            </View>
          )}
          {iapBanner && !iapBusy && !healthBusy && (
            <Pressable style={styles.banner} onPress={() => setIapBanner(null)}>
              <Text style={styles.bannerText}>{iapBanner}</Text>
            </Pressable>
          )}
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

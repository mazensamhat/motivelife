"use client";

import { useEffect } from "react";
import { isNativeShell } from "@/lib/native-shell";

/**
 * Persist the session JWT into the Expo shell (SecureStore) so iOS can
 * re-set the httpOnly cookie after WKWebView drops it on app kill.
 * Also tells RevenueCat the logged-in user id.
 */
export function NativeIapSessionBridge() {
  useEffect(() => {
    if (!isNativeShell() || !window.ReactNativeWebView) return;

    let cancelled = false;
    (async () => {
      try {
        // Prefer minting a native JWT while the cookie still works.
        const sessionRes = await fetch("/api/auth/native-session", {
          credentials: "include",
        });
        if (sessionRes.ok && !cancelled) {
          const data = (await sessionRes.json()) as {
            token?: string;
            userId?: string;
          };
          if (data.userId || data.token) {
            window.ReactNativeWebView?.postMessage(
              JSON.stringify({
                type: "session",
                userId: data.userId,
                sessionToken: data.token,
              })
            );
          }
          return;
        }

        // Fallback: subscription status still exposes userId when cookie works.
        const res = await fetch("/api/subscription/status", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { userId?: string };
        if (data.userId) {
          window.ReactNativeWebView?.postMessage(
            JSON.stringify({ type: "session", userId: data.userId })
          );
        }
      } catch {
        // not logged in
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

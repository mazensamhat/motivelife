"use client";

import { useEffect } from "react";
import { isNativeShell } from "@/lib/native-shell";

/** Tell the Expo shell the logged-in user id so RevenueCat can logIn. */
export function NativeIapSessionBridge() {
  useEffect(() => {
    if (!isNativeShell() || !window.ReactNativeWebView) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/subscription/status");
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

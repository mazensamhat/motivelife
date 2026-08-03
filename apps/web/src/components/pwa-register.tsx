"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Dev + native WebView: remove service workers that can keep stale Family Map UI.
    const isNative =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("motivelife-native-shell");

    if (process.env.NODE_ENV !== "production" || isNative) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => void reg.unregister());
      });
      if (typeof caches !== "undefined") {
        void caches.keys().then((keys) => {
          keys.forEach((key) => void caches.delete(key));
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional in production */
    });
  }, []);

  return null;
}

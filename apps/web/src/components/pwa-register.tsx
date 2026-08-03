"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isNative =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("motivelife-native-shell");

    // Always drop stale service workers once after the Family Intelligence lock
    // ship — cached shells were keeping the old purple upgrade card alive.
    const LOCK_SW_BUST = "motivelife-lock-bust-v1";
    let alreadyBusted = false;
    try {
      alreadyBusted = window.localStorage.getItem(LOCK_SW_BUST) === "1";
    } catch {
      alreadyBusted = false;
    }

    if (process.env.NODE_ENV !== "production" || isNative || !alreadyBusted) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => void reg.unregister());
      });
      if (typeof caches !== "undefined") {
        void caches.keys().then((keys) => {
          keys.forEach((key) => void caches.delete(key));
        });
      }
      if (!alreadyBusted && process.env.NODE_ENV === "production" && !isNative) {
        try {
          window.localStorage.setItem(LOCK_SW_BUST, "1");
        } catch {
          /* ignore */
        }
        // One reload so Tim/free users pick up the blurred lock modules.
        if (!window.sessionStorage.getItem("motivelife-lock-reloaded")) {
          try {
            window.sessionStorage.setItem("motivelife-lock-reloaded", "1");
          } catch {
            /* ignore */
          }
          window.location.reload();
          return;
        }
      }
      if (process.env.NODE_ENV !== "production" || isNative) return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional in production */
    });
  }, []);

  return null;
}

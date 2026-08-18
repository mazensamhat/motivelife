"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { autoSyncHealth } from "@/lib/auto-health-sync";

const INTERVAL_MS = 15 * 60 * 1000;

/**
 * Silently refreshes phone health (Apple Health / Health Connect) while the
 * signed-in dashboard is open. Fitbit is pulled on the server.
 */
export function AutoHealthSync() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const run = (force = false) => {
      if (cancelled || document.visibilityState === "hidden") return;
      void autoSyncHealth({ force, pathname });
    };

    const boot = window.setTimeout(() => run(false), 1800);

    const onVisible = () => {
      if (document.visibilityState === "visible") run(false);
    };
    const onAppActive = () => run(false);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("motivelife-app-active", onAppActive);
    window.addEventListener("focus", onVisible);

    const interval = window.setInterval(() => run(false), INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("motivelife-app-active", onAppActive);
      window.removeEventListener("focus", onVisible);
    };
  }, [pathname]);

  return null;
}

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { viewportFromWidth, type ViewportTier } from "@/lib/viewport";

const ViewportContext = createContext<ViewportTier>("desktop");

/** Fold/Flip outer cover CSS width heuristic (Galaxy Z Fold cover ~360–400 CSS px). */
const COVER_SCREEN_MAX_CSS_PX = 420;

function syncCoverScreenClass() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  // Use layout viewport only. On Fold, screen.width can stay at the cover
  // size after unfold — Math.min(innerWidth, screen.width) wrongly kept the
  // cover chrome CSS on the large inner display (pushed-down / squished menu).
  const cssW = window.innerWidth || 0;
  document.documentElement.classList.toggle(
    "motivelife-cover-screen",
    cssW > 0 && cssW <= COVER_SCREEN_MAX_CSS_PX
  );
}

export function ViewportProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<ViewportTier>("desktop");

  useEffect(() => {
    function update() {
      const next = viewportFromWidth(window.innerWidth);
      setTier(next);
      document.documentElement.setAttribute("data-viewport", next);
      syncCoverScreenClass();
    }
    update();
    let prev = { w: window.innerWidth || 0, h: window.innerHeight || 0 };
    const onResize = () => {
      const next = { w: window.innerWidth || 0, h: window.innerHeight || 0 };
      const keyboardOnly =
        Math.abs(next.w - prev.w) < 12 && Math.abs(next.h - prev.h) >= 72;
      prev = next;
      if (keyboardOnly) return;
      update();
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("motivelife-cover-screen");
    };
  }, []);

  return <ViewportContext.Provider value={tier}>{children}</ViewportContext.Provider>;
}

/** Prefer this inside ViewportProvider to avoid duplicate resize listeners. */
export function useViewportContext(): ViewportTier {
  return useContext(ViewportContext);
}

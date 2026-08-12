"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { viewportFromWidth, type ViewportTier } from "@/lib/viewport";

const ViewportContext = createContext<ViewportTier>("desktop");

/** Fold/Flip outer cover CSS width heuristic (Galaxy Z Fold cover ~360–400 CSS px). */
const COVER_SCREEN_MAX_CSS_PX = 420;

function syncCoverScreenClass() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const cssW = window.innerWidth || 0;
  const screenW =
    typeof screen !== "undefined" && screen.width ? screen.width : 0;
  // Prefer the smaller of layout vs screen width so folded outer displays classify correctly.
  const w = Math.min(cssW || screenW, screenW || cssW) || cssW;
  document.documentElement.classList.toggle(
    "motivelife-cover-screen",
    w > 0 && w <= COVER_SCREEN_MAX_CSS_PX
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
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      document.documentElement.classList.remove("motivelife-cover-screen");
    };
  }, []);

  return <ViewportContext.Provider value={tier}>{children}</ViewportContext.Provider>;
}

/** Prefer this inside ViewportProvider to avoid duplicate resize listeners. */
export function useViewportContext(): ViewportTier {
  return useContext(ViewportContext);
}

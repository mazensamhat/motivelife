"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { viewportFromWidth, type ViewportTier } from "@/lib/viewport";

const ViewportContext = createContext<ViewportTier>("desktop");

export function ViewportProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<ViewportTier>("desktop");

  useEffect(() => {
    function update() {
      const next = viewportFromWidth(window.innerWidth);
      setTier(next);
      document.documentElement.setAttribute("data-viewport", next);
    }
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return <ViewportContext.Provider value={tier}>{children}</ViewportContext.Provider>;
}

/** Prefer this inside ViewportProvider to avoid duplicate resize listeners. */
export function useViewportContext(): ViewportTier {
  return useContext(ViewportContext);
}

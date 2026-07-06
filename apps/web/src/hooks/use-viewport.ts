"use client";

import { useEffect, useState } from "react";
import { viewportFromWidth, type ViewportTier } from "@/lib/viewport";

export function useViewport(): ViewportTier {
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

  return tier;
}

export function useIsMobile() {
  return useViewport() === "mobile";
}

export function useIsTablet() {
  return useViewport() === "tablet";
}

export function useIsDesktop() {
  return useViewport() === "desktop";
}

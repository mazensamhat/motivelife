"use client";

import { useEffect } from "react";
import { trackCta } from "@/lib/analytics";

/** Captures clicks on elements with data-track (and optional data-track-* props). */
export function TrackClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-track]",
      ) as HTMLElement | null;
      if (!el) return;
      const name = el.getAttribute("data-track");
      if (!name) return;
      const props: Record<string, string> = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-track-") && attr.name !== "data-track") {
          props[attr.name.slice("data-track-".length)] = attr.value;
        }
      }
      trackCta(name, Object.keys(props).length ? props : undefined);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

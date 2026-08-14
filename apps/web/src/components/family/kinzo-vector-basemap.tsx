"use client";

import { useEffect, useMemo } from "react";
import { TileLayer, useMap } from "react-leaflet";
import {
  KINZO_THEME_META,
  type KinzoMapTheme,
} from "@/lib/family-map/kinzo-map-style";

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Carto raster basemap — reliable in iOS/Android WebViews.
 * MapLibre-under-Leaflet left a blank canvas (overlays only) and was choppy.
 * Light → Voyager (day), Midnight → Dark Matter.
 */
const RASTER: Record<KinzoMapTheme, string> = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  midnight: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
};

function isPhoneLikeClient(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    const narrow = window.matchMedia?.("(max-width: 900px)")?.matches;
    const ua = navigator.userAgent || "";
    const native =
      /MotiveLife|wv\)|Android.*Version\/|iPhone|iPad|iPod|Mobile/i.test(ua) ||
      Boolean(
        (window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView
      );
    return Boolean(coarse || narrow || native);
  } catch {
    return true;
  }
}

export function KinzoVectorBasemap({
  theme = "light",
}: {
  theme?: KinzoMapTheme;
  /** Kept for call-site compatibility; pitch disabled (blanked phones). */
  pitchDeg?: number;
}) {
  const map = useMap();
  const meta = KINZO_THEME_META[theme];
  const url = RASTER[theme];
  const phone = useMemo(() => isPhoneLikeClient(), []);

  useEffect(() => {
    const container = map.getContainer();
    if (container) container.style.background = meta.canvas;
    map.attributionControl?.addAttribution(OSM_ATTR);
    return () => {
      try {
        map.attributionControl?.removeAttribution(OSM_ATTR);
      } catch {
        // ignore
      }
    };
  }, [map, meta.canvas]);

  return (
    <TileLayer
      key={`kinzo-raster-${theme}`}
      url={url}
      attribution={OSM_ATTR}
      maxZoom={22}
      maxNativeZoom={20}
      subdomains="abcd"
      // Fewer tile thrash updates while pinching on Fold / iPhone WebView.
      updateWhenIdle={phone}
      updateWhenZooming={!phone}
      keepBuffer={phone ? 2 : 4}
      opacity={1}
      zIndex={1}
    />
  );
}

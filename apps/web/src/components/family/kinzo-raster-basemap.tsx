"use client";

import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import {
  KINZO_THEME_META,
  type KinzoMapTheme,
} from "@/lib/family-map/kinzo-map-style";

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * KINZO streets basemap — plain Leaflet raster tiles.
 *
 * Light → CARTO Voyager. Midnight → CARTO dark raster.
 * Single TileLayer — theme toggles update URL in place (no remount flash).
 * Do NOT pass `subdomains={undefined}` — Leaflet `_getSubdomain` crashes on it.
 */
export function KinzoRasterBasemap({
  theme = "light",
}: {
  theme?: KinzoMapTheme;
}) {
  const map = useMap();
  const canvas = KINZO_THEME_META[theme]?.canvas ?? "#e8eef5";
  const url =
    theme === "midnight"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

  useEffect(() => {
    const container = map.getContainer();
    if (container) container.style.background = canvas;
  }, [map, canvas]);

  return (
    <TileLayer
      url={url}
      attribution={ATTRIBUTION}
      subdomains="abcd"
      maxNativeZoom={20}
      maxZoom={22}
      updateWhenZooming
      keepBuffer={4}
    />
  );
}

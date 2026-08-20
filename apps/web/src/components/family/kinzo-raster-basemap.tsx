"use client";

import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import {
  KINZO_THEME_META,
  type KinzoMapTheme,
} from "@/lib/family-map/kinzo-map-style";

/**
 * KINZO streets basemap — plain Leaflet raster tiles.
 *
 * Light → OpenStreetMap (pre-MapLibre path).
 * Midnight → CARTO dark raster.
 * Do NOT pass `subdomains={undefined}` — Leaflet `_getSubdomain` crashes on it.
 */
export function KinzoRasterBasemap({
  theme = "light",
}: {
  theme?: KinzoMapTheme;
}) {
  const map = useMap();
  const canvas = KINZO_THEME_META[theme]?.canvas ?? "#e8eef5";

  useEffect(() => {
    const container = map.getContainer();
    if (container) container.style.background = canvas;
  }, [map, canvas]);

  if (theme === "midnight") {
    return (
      <TileLayer
        key="kinzo-raster-midnight"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxNativeZoom={20}
        maxZoom={22}
        updateWhenZooming
        keepBuffer={4}
      />
    );
  }

  return (
    <TileLayer
      key="kinzo-raster-light"
      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>'
      subdomains="abcd"
      maxNativeZoom={20}
      maxZoom={22}
      updateWhenZooming
      keepBuffer={4}
    />
  );
}

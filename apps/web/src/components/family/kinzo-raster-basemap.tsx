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
 * Light → OpenStreetMap (the fast, stable pre-MapLibre map).
 * Midnight → CARTO dark raster.
 * Intelligence overlays (orbs, pins, routes) stay on Leaflet above this.
 */
const STREETS: Record<
  KinzoMapTheme,
  { url: string; attribution: string; subdomains?: string }
> = {
  light: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  midnight: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
};

export function KinzoRasterBasemap({
  theme = "light",
}: {
  theme?: KinzoMapTheme;
}) {
  const map = useMap();
  const tiles = STREETS[theme] ?? STREETS.light;
  const canvas = KINZO_THEME_META[theme]?.canvas ?? "#e8eef5";

  useEffect(() => {
    const container = map.getContainer();
    if (container) container.style.background = canvas;
  }, [map, canvas]);

  return (
    <TileLayer
      key={`kinzo-raster-${theme}`}
      url={tiles.url}
      attribution={tiles.attribution}
      subdomains={tiles.subdomains}
      maxNativeZoom={19}
      maxZoom={22}
      updateWhenIdle={false}
      updateWhenZooming
      keepBuffer={2}
      opacity={1}
      zIndex={0}
    />
  );
}

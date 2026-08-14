"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Map as MaplibreMap } from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  KINZO_THEME_META,
  type KinzoMapTheme,
} from "@/lib/family-map/kinzo-map-style";

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org/">OpenFreeMap</a>';

/**
 * OpenFreeMap → MapLibre vector basemap under Leaflet overlays.
 * Neutral streets by design — strong colour lives on the active family route.
 */
export function KinzoVectorBasemap({
  theme = "light",
  pitchDeg = 0,
}: {
  theme?: KinzoMapTheme;
  /** Soft camera tilt while following a drive. */
  pitchDeg?: number;
}) {
  const map = useMap();
  const layerRef = useRef<L.MaplibreGL | null>(null);
  const themeRef = useRef(theme);

  useEffect(() => {
    const meta = KINZO_THEME_META[theme];
    const layer = L.maplibreGL({
      style: meta.styleUrl,
      interactive: false,
    });
    layer.addTo(map);
    layerRef.current = layer;
    themeRef.current = theme;
    map.attributionControl?.addAttribution(OSM_ATTR);

    const container = map.getContainer();
    if (container) container.style.background = meta.canvas;

    const ml = layer.getMaplibreMap?.();
    if (ml) {
      try {
        ml.dragPan.disable();
        ml.scrollZoom.disable();
        ml.boxZoom.disable();
        ml.dragRotate.disable();
        ml.keyboard.disable();
        ml.doubleClickZoom.disable();
        ml.touchZoomRotate.disable();
      } catch {
        // ignore
      }
      (map as L.Map & { __kinzoMaplibre?: MaplibreMap }).__kinzoMaplibre = ml;
    }

    return () => {
      try {
        map.attributionControl?.removeAttribution(OSM_ATTR);
      } catch {
        // ignore
      }
      try {
        map.removeLayer(layer);
      } catch {
        // ignore
      }
      layerRef.current = null;
      const tagged = map as L.Map & { __kinzoMaplibre?: MaplibreMap };
      if (tagged.__kinzoMaplibre) delete tagged.__kinzoMaplibre;
    };
  }, [map, theme]);

  useEffect(() => {
    const ml = layerRef.current?.getMaplibreMap?.();
    if (!ml) return;
    const next = Math.max(0, Math.min(60, pitchDeg));
    try {
      if (typeof ml.getPitch === "function" && Math.abs(ml.getPitch() - next) < 0.5) {
        return;
      }
      ml.easeTo({ pitch: next, duration: 700, easing: (t) => 1 - (1 - t) ** 2 });
    } catch {
      try {
        ml.setPitch(next);
      } catch {
        // Pitch unsupported.
      }
    }
  }, [pitchDeg]);

  return null;
}

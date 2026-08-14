"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Map as MaplibreMap } from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";

/** Hosted KINZO vector style — OpenFreeMap tiles + MotiveLife polish. */
export const KINZO_STYLE_URL = "/map-styles/kinzo.json";

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org/">OpenFreeMap</a>';

/**
 * OpenFreeMap → MapLibre vector basemap under Leaflet overlays.
 * Keeps family pins / geofences / routes on Leaflet while the ground map
 * becomes a styled vector canvas (buildings, parks, road hierarchy, 3D).
 */
export function KinzoVectorBasemap({
  pitchDeg = 0,
}: {
  /** Soft camera tilt (MapLibre) — used while following a drive. */
  pitchDeg?: number;
}) {
  const map = useMap();
  const layerRef = useRef<L.MaplibreGL | null>(null);

  useEffect(() => {
    const layer = L.maplibreGL({
      style: KINZO_STYLE_URL,
      interactive: false,
    });
    layer.addTo(map);
    layerRef.current = layer;
    map.attributionControl?.addAttribution(OSM_ATTR);

    const ml = layer.getMaplibreMap?.();
    if (ml) {
      // Avoid MapLibre competing with Leaflet gesture handling.
      try {
        ml.dragPan.disable();
        ml.scrollZoom.disable();
        ml.boxZoom.disable();
        ml.dragRotate.disable();
        ml.keyboard.disable();
        ml.doubleClickZoom.disable();
        ml.touchZoomRotate.disable();
      } catch {
        // Older MapLibre builds may differ.
      }
      (map as L.Map & { __kinzoMaplibre?: MaplibreMap }).__kinzoMaplibre = ml;
    }

    return () => {
      try {
        map.attributionControl?.removeAttribution(OSM_ATTR);
      } catch {
        // Attribution control may already be gone.
      }
      try {
        map.removeLayer(layer);
      } catch {
        // Map mid-teardown.
      }
      layerRef.current = null;
      const tagged = map as L.Map & { __kinzoMaplibre?: MaplibreMap };
      if (tagged.__kinzoMaplibre) delete tagged.__kinzoMaplibre;
    };
  }, [map]);

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
        // Pitch unsupported in this bridge build.
      }
    }
  }, [pitchDeg]);

  return null;
}

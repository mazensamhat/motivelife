"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  KINZO_THEME_META,
  type KinzoMapTheme,
} from "@/lib/family-map/kinzo-map-style";

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org/">OpenFreeMap</a>';

/**
 * Carto raster — the only reliable streets basemap inside phone WebViews.
 * MapLibre-under-Leaflet briefly paints, then covers the map with an empty
 * opaque canvas when `load` fires before tiles arrive (appear → disappear).
 */
const RASTER: Record<KinzoMapTheme, string> = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  midnight: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
};

function isPhoneLikeClient(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches === true;
    const narrow = window.matchMedia?.("(max-width: 900px)")?.matches === true;
    const ua = navigator.userAgent || "";
    const nativeShell =
      /MotiveLife|wv\)|; wv\)|Android.*Version\/[\d.]+ Chrome\/[\d.]+ Mobile|iPhone|iPad|iPod/i.test(
        ua
      ) ||
      Boolean(
        (window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView
      );
    // Prefer stable raster whenever this feels like a phone / Fold / in-app WebView.
    return coarse || narrow || nativeShell;
  } catch {
    return true;
  }
}

function absoluteStyleUrl(path: string): string {
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.href).toString();
  } catch {
    return path;
  }
}

async function loadKinzoStyle(stylePath: string): Promise<StyleSpecification> {
  const url = absoluteStyleUrl(stylePath);
  const res = await fetch(url, {
    credentials: "same-origin",
    referrerPolicy: "strict-origin-when-cross-origin",
  });
  if (!res.ok) throw new Error(`KINZO style ${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  // Let the raster underlay show through until vector tiles actually paint.
  // Opaque background + late/missing tiles = "map disappeared" on WebView.
  if (Array.isArray(style.layers)) {
    for (const layer of style.layers) {
      if (layer.id === "background" && layer.type === "background") {
        layer.paint = {
          ...(layer.paint ?? {}),
          "background-opacity": 0,
        };
      }
    }
  }
  return style;
}

function RasterBasemap({
  theme,
  phone,
}: {
  theme: KinzoMapTheme;
  phone: boolean;
}) {
  return (
    <TileLayer
      key={`kinzo-raster-${theme}`}
      url={RASTER[theme]}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>'
      maxZoom={22}
      maxNativeZoom={20}
      subdomains="abcd"
      updateWhenIdle={phone}
      updateWhenZooming={!phone}
      keepBuffer={phone ? 2 : 4}
      opacity={1}
      zIndex={0}
    />
  );
}

/**
 * KINZO streets basemap.
 *
 * Phone / Fold / in-app WebView → Carto raster only (stable; never blank).
 * Desktop → MapLibre vector (POIs / landuse / buildings) over a permanent
 * raster underlay so a failed GL paint cannot erase the map.
 */
export function KinzoVectorBasemap({
  theme = "light",
}: {
  theme?: KinzoMapTheme;
  pitchDeg?: number;
}) {
  const map = useMap();
  const meta = KINZO_THEME_META[theme];
  const phone = useMemo(() => isPhoneLikeClient(), []);
  const layerRef = useRef<L.MaplibreGL | null>(null);
  const [useVector, setUseVector] = useState(false);

  useEffect(() => {
    const container = map.getContainer();
    if (container) container.style.background = meta.canvas;
  }, [map, meta.canvas]);

  // Phones: never mount MapLibre under Leaflet — that path is what blanked the map.
  useEffect(() => {
    if (phone) {
      setUseVector(false);
      return;
    }

    let cancelled = false;
    let layer: L.MaplibreGL | null = null;
    map.attributionControl?.addAttribution(OSM_ATTR);

    void (async () => {
      try {
        const style = await loadKinzoStyle(meta.styleUrl);
        if (cancelled) return;

        const opts = {
          style,
          interactive: false,
          padding: 0.1,
          updateInterval: 32,
          fadeDuration: 0,
          maxPitch: 0,
          pitchWithRotate: false,
          transformRequest: (url: string) => ({
            url,
            referrerPolicy: "strict-origin-when-cross-origin" as ReferrerPolicy,
          }),
        };
        layer = L.maplibreGL(opts as Parameters<typeof L.maplibreGL>[0]);
        layer.addTo(map);
        layerRef.current = layer;

        const ml = layer.getMaplibreMap?.() as MaplibreMap | undefined;
        if (!ml) {
          try {
            map.removeLayer(layer);
          } catch {
            // ignore
          }
          layerRef.current = null;
          return;
        }

        try {
          ml.dragPan.disable();
          ml.scrollZoom.disable();
          ml.boxZoom.disable();
          ml.dragRotate.disable();
          ml.keyboard.disable();
          ml.doubleClickZoom.disable();
          ml.touchZoomRotate.disable();
          ml.setPitch(0);
        } catch {
          // ignore
        }

        const onLoad = () => {
          if (!cancelled) setUseVector(true);
        };
        const onError = () => {
          if (cancelled) return;
          // Keep raster; tear down a broken GL layer so it cannot cover the map.
          try {
            if (layer) map.removeLayer(layer);
          } catch {
            // ignore
          }
          layerRef.current = null;
          setUseVector(false);
        };

        ml.on("load", onLoad);
        ml.on("error", onError);
        if (ml.isStyleLoaded()) onLoad();

        (map as L.Map & { __kinzoMaplibre?: MaplibreMap }).__kinzoMaplibre = ml;
      } catch {
        setUseVector(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        map.attributionControl?.removeAttribution(OSM_ATTR);
      } catch {
        // ignore
      }
      if (layer) {
        try {
          map.removeLayer(layer);
        } catch {
          // ignore
        }
      }
      layerRef.current = null;
      const tagged = map as L.Map & { __kinzoMaplibre?: MaplibreMap };
      if (tagged.__kinzoMaplibre) delete tagged.__kinzoMaplibre;
      setUseVector(false);
    };
  }, [map, meta.styleUrl, phone, theme]);

  // Permanent raster underlay — never unmount on "vector ready".
  // That unmount was the appear→disappear bug on mobile.
  return (
    <RasterBasemap theme={theme} phone={phone || !useVector} />
  );
}

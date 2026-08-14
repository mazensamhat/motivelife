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

const RASTER_FALLBACK: Record<KinzoMapTheme, string> = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  midnight: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
};

const VECTOR_LOAD_MS = 4500;

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
  return (await res.json()) as StyleSpecification;
}

/**
 * KINZO streets: MapLibre vector (POIs / roads / landuse / buildings) with a
 * Carto raster underlay so phones never sit blank while GL boots.
 * Pitch stays off — it blanked WebViews and caused chop.
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
  const [vectorReady, setVectorReady] = useState(false);
  const [vectorFailed, setVectorFailed] = useState(false);

  useEffect(() => {
    const container = map.getContainer();
    if (container) container.style.background = meta.canvas;
    map.attributionControl?.addAttribution(OSM_ATTR);

    let cancelled = false;
    let failTimer: number | null = null;
    let layer: L.MaplibreGL | null = null;

    setVectorReady(false);
    setVectorFailed(false);

    const markFailed = () => {
      if (cancelled) return;
      setVectorFailed(true);
      setVectorReady(false);
      if (layer) {
        try {
          map.removeLayer(layer);
        } catch {
          // ignore
        }
        layer = null;
        layerRef.current = null;
      }
    };

    failTimer = window.setTimeout(() => {
      const ml = layerRef.current?.getMaplibreMap?.();
      const loaded =
        typeof ml?.isStyleLoaded === "function" ? ml.isStyleLoaded() : false;
      if (!cancelled && !loaded) markFailed();
    }, VECTOR_LOAD_MS);

    void (async () => {
      try {
        const style = await loadKinzoStyle(meta.styleUrl);
        if (cancelled) return;

        const opts = {
          style,
          interactive: false,
          padding: phone ? 0.05 : 0.1,
          updateInterval: phone ? 48 : 32,
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
          markFailed();
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
          if (cancelled) return;
          if (failTimer != null) window.clearTimeout(failTimer);
          setVectorReady(true);
          setVectorFailed(false);
        };
        const onError = () => {
          if (cancelled) return;
          try {
            if (!ml.isStyleLoaded()) markFailed();
          } catch {
            markFailed();
          }
        };

        ml.on("load", onLoad);
        ml.on("error", onError);
        if (ml.isStyleLoaded()) onLoad();

        (map as L.Map & { __kinzoMaplibre?: MaplibreMap }).__kinzoMaplibre = ml;
      } catch {
        markFailed();
      }
    })();

    return () => {
      cancelled = true;
      if (failTimer != null) window.clearTimeout(failTimer);
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
    };
  }, [map, meta.canvas, meta.styleUrl, phone, theme]);

  const showRaster = !vectorReady || vectorFailed;

  return showRaster ? (
    <TileLayer
      key={`kinzo-raster-underlay-${theme}-${vectorFailed ? "fail" : "boot"}`}
      url={RASTER_FALLBACK[theme]}
      attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
      maxZoom={22}
      maxNativeZoom={20}
      subdomains="abcd"
      updateWhenIdle={phone}
      updateWhenZooming={!phone}
      keepBuffer={phone ? 2 : 4}
      opacity={1}
      zIndex={0}
    />
  ) : null;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { authFetch } from "@/lib/auth-fetch";
import type { KinzoEyeDensity } from "@/lib/family-map/kinzo-map-style";
import {
  filterPoisForView,
  kinzoPoiIconHtml,
  kinzoPoiMinZoom,
  KINZO_POI_META,
  type KinzoPoi,
} from "@/lib/family-map/kinzo-pois";

type BoundsKey = string;

function boundsKey(b: L.LatLngBounds, zoom: number): BoundsKey {
  return [
    b.getSouth().toFixed(3),
    b.getWest().toFixed(3),
    b.getNorth().toFixed(3),
    b.getEast().toFixed(3),
    Math.floor(zoom * 2) / 2,
  ].join("|");
}

function poiIcon(poi: KinzoPoi): L.DivIcon {
  return L.divIcon({
    className: "kinzo-poi-marker",
    html: kinzoPoiIconHtml(poi),
    iconSize: [120, 36],
    iconAnchor: [18, 18],
  });
}

/**
 * Hard-loads restaurants, gas, hotels, hospitals (etc.) as KINZO bubbly
 * Leaflet markers — works on the phone raster basemap.
 */
export function KinzoPoisLayer({
  enabled = true,
  eyeDensity = "focused",
}: {
  enabled?: boolean;
  eyeDensity?: KinzoEyeDensity;
}) {
  const map = useMap();
  const [pois, setPois] = useState<KinzoPoi[]>([]);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [viewRev, setViewRev] = useState(0);
  const cacheRef = useRef<Map<BoundsKey, KinzoPoi[]>>(new Map());
  const inflightRef = useRef(0);

  const minZoom = kinzoPoiMinZoom(eyeDensity);

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setViewRev((n) => n + 1);
    },
    moveend: () => {
      setZoom(map.getZoom());
      setViewRev((n) => n + 1);
    },
  });

  useEffect(() => {
    if (!enabled) {
      setPois([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const z = map.getZoom();
      if (z < minZoom) {
        setPois([]);
        return;
      }
      const b = map.getBounds().pad(0.12);
      const key = boundsKey(b, z);
      const cached = cacheRef.current.get(key);
      if (cached) {
        setPois(cached);
        return;
      }

      const seq = ++inflightRef.current;
      try {
        const url = new URL("/api/family/map-pois", window.location.origin);
        url.searchParams.set("south", String(b.getSouth()));
        url.searchParams.set("west", String(b.getWest()));
        url.searchParams.set("north", String(b.getNorth()));
        url.searchParams.set("east", String(b.getEast()));
        url.searchParams.set("density", eyeDensity);

        const res = await authFetch(url.toString(), { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as { pois?: KinzoPoi[] };
        if (cancelled || seq !== inflightRef.current) return;
        const list = data.pois ?? [];
        cacheRef.current.set(key, list);
        while (cacheRef.current.size > 24) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest == null) break;
          cacheRef.current.delete(oldest);
        }
        setPois(list);
      } catch {
        // Overpass hiccup — keep prior pois
      }
    };

    const t = window.setTimeout(() => void run(), 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [map, enabled, eyeDensity, minZoom, viewRev]);

  const visible = useMemo(
    () => filterPoisForView(pois, zoom, eyeDensity),
    [pois, zoom, eyeDensity]
  );

  if (!enabled || zoom < minZoom) return null;

  return (
    <>
      {visible.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={poiIcon(p)}
          interactive
          zIndexOffset={200}
        >
          <Popup className="kinzo-poi-popup" closeButton maxWidth={220}>
            <div className="kinzo-poi-detail">
              <p
                className="kinzo-poi-detail-kicker"
                style={{ color: KINZO_POI_META[p.kind].color }}
              >
                {KINZO_POI_META[p.kind].label}
              </p>
              <p className="kinzo-poi-detail-title">{p.name}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

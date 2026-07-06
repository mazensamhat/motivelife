"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { countryDisplayName } from "@/lib/geo/continents";
import "leaflet/dist/leaflet.css";

export type SignupMapPoint = {
  id: string;
  lat: number;
  lng: number;
  city?: string | null;
  region?: string | null;
  country: string;
};

const MAP_HEIGHT = 480;

const signupIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:14px;height:14px;background:#34d399;border:2px solid #ecfdf5;border-radius:50%;box-shadow:0 0 8px rgba(52,211,153,0.55)"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -8],
});

/** Leaflet needs an explicit size recalc after the container mounts or resizes. */
function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const fix = () => {
      map.invalidateSize({ animate: false });
    };
    fix();
    const t1 = setTimeout(fix, 50);
    const t2 = setTimeout(fix, 300);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fix);
    };
  }, [map]);

  return null;
}

function FitBoundsOnce({
  fitKey,
  points,
}: {
  fitKey: string;
  points: SignupMapPoint[];
}) {
  const map = useMap();
  const lastFitKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;

    if (points.length === 0) {
      map.setView([20, 0], 2, { animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12, animate: false });
  }, [map, fitKey, points]);

  return null;
}

export default function SignupLeafletMap({
  points,
  fitKey,
}: {
  points: SignupMapPoint[];
  fitKey: string;
}) {
  const center = useMemo((): [number, number] => {
    if (points.length === 0) return [20, 0];
    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return [lat, lng];
  }, [points]);

  const initialZoom = points.length === 0 ? 2 : points.length === 1 ? 11 : 4;

  return (
    <MapContainer
      center={center}
      zoom={initialZoom}
      minZoom={2}
      maxZoom={18}
      className="signup-leaflet-map z-0"
      scrollWheelZoom
      style={{ height: MAP_HEIGHT, width: "100%", background: "#0a1628" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        maxZoom={19}
        maxNativeZoom={19}
      />
      <MapResizeFix />
      <FitBoundsOnce fitKey={fitKey} points={points} />
      {points.map((p) => {
        const label = [p.city, p.region, countryDisplayName(p.country)].filter(Boolean).join(", ");
        return (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={signupIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-forward-900">{label || "Signup location"}</p>
                <p className="mt-1 text-xs text-forward-600">
                  {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

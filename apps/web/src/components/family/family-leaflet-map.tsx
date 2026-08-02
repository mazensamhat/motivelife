"use client";

import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { FamilyMapMemberView, FamilyPlaceView } from "@forward/shared";
import "leaflet/dist/leaflet.css";

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
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

function FitBounds({
  fitKey,
  points,
}: {
  fitKey: string;
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === fitKey) return;
    last.current = fitKey;
    if (points.length === 0) {
      map.setView([43.65, -79.38], 11, { animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], 13, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 14, animate: false });
  }, [fitKey, map, points]);
  return null;
}

function memberIcon(color: string, label: string, selected: boolean) {
  const size = selected ? 36 : 30;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:${color};color:#050d18;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.35)">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function FamilyLeafletMap({
  members,
  places,
  selectedMemberId,
  onSelectMember,
}: {
  members: FamilyMapMemberView[];
  places: FamilyPlaceView[];
  selectedMemberId: string | null;
  onSelectMember: (id: string) => void;
}) {
  const points = useMemo(() => {
    const fromMembers = members
      .filter((m) => m.lat != null && m.lng != null)
      .map((m) => ({ lat: m.lat!, lng: m.lng! }));
    const fromPlaces = places.map((p) => ({ lat: p.lat, lng: p.lng }));
    return fromMembers.length ? fromMembers : fromPlaces;
  }, [members, places]);

  const fitKey = useMemo(
    () =>
      [...members.map((m) => `${m.id}:${m.lat}:${m.lng}`), ...places.map((p) => p.id)].join("|"),
    [members, places]
  );

  const center = points[0] ?? { lat: 43.65, lng: -79.38 };

  return (
    <div className="family-live-map h-full min-h-[22rem] w-full overflow-hidden rounded-2xl border border-forward-200 bg-forward-950">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom
        style={{ height: "100%", width: "100%", minHeight: "22rem" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapResizeFix />
        <FitBounds fitKey={fitKey} points={points} />

        {places.map((place) => (
          <Circle
            key={place.id}
            center={[place.lat, place.lng]}
            radius={place.radiusM}
            pathOptions={{
              color: "#00c6ff",
              fillColor: "#00c6ff",
              fillOpacity: 0.08,
              weight: 1,
            }}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.visitCount} visits
              {place.insight ? (
                <>
                  <br />
                  {place.insight}
                </>
              ) : null}
            </Popup>
          </Circle>
        ))}

        {members.map((member) => {
          if (member.lat == null || member.lng == null) return null;
          const initial = member.displayName.slice(0, 2).toUpperCase();
          return (
            <Marker
              key={member.id}
              position={[member.lat, member.lng]}
              icon={memberIcon(member.color, initial, selectedMemberId === member.id)}
              eventHandlers={{ click: () => onSelectMember(member.id) }}
            >
              <Popup>
                <strong>{member.displayName}</strong>
                <br />
                {member.statusLabel}
                {member.speedKmh != null ? (
                  <>
                    <br />
                    {Math.round(member.speedKmh)} km/h
                  </>
                ) : null}
                {member.batteryPercent != null ? (
                  <>
                    <br />
                    Battery {member.batteryPercent}%
                  </>
                ) : null}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

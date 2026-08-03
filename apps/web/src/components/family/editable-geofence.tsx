"use client";

import { useEffect, useMemo } from "react";
import { Circle, Marker, Rectangle, useMap } from "react-leaflet";
import L from "leaflet";
import type { FamilyPlaceShape } from "@forward/shared";
import { offsetLatLngMeters, squareBounds } from "@/lib/family-map/geofence";

export type EditableGeofenceDraft = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  shape: FamilyPlaceShape;
};

function centerIcon() {
  return L.divIcon({
    className: "geofence-center-pin",
    html: `<div style="width:22px;height:22px;border-radius:999px;background:#0f172a;border:3px solid #fff;box-shadow:0 2px 10px rgba(15,23,42,.45);cursor:grab"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function resizeHandleIcon() {
  return L.divIcon({
    className: "geofence-resize-handle",
    html: `<div style="width:18px;height:18px;border-radius:4px;background:#fff;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:nwse-resize"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FlyToGeofenceOnce({
  placeId,
  lat,
  lng,
}: {
  placeId: string;
  lat: number;
  lng: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.35 });
    // Only when selecting a place — not on every drag tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, placeId]);
  return null;
}

/**
 * Selected place: drag center pin to move, drag edge handle to resize.
 * Shape is circle or axis-aligned square.
 */
export function EditableGeofence({
  draft,
  onChange,
}: {
  draft: EditableGeofenceDraft;
  onChange: (next: EditableGeofenceDraft) => void;
}) {
  const handlePos = useMemo(
    () => offsetLatLngMeters(draft.lat, draft.lng, 0, draft.radiusM),
    [draft.lat, draft.lng, draft.radiusM]
  );

  const bounds = useMemo(
    () => squareBounds(draft.lat, draft.lng, draft.radiusM),
    [draft.lat, draft.lng, draft.radiusM]
  );

  const path = {
    color: "#0f172a",
    fillColor: "#0f172a",
    fillOpacity: 0.16,
    weight: 3,
  };

  return (
    <>
      <FlyToGeofenceOnce placeId={draft.id} lat={draft.lat} lng={draft.lng} />

      {draft.shape === "square" ? (
        <Rectangle bounds={bounds} pathOptions={path} />
      ) : (
        <Circle center={[draft.lat, draft.lng]} radius={draft.radiusM} pathOptions={path} />
      )}

      <Marker
        position={[draft.lat, draft.lng]}
        icon={centerIcon()}
        draggable
        zIndexOffset={1200}
        eventHandlers={{
          drag(e) {
            const ll = (e.target as L.Marker).getLatLng();
            onChange({ ...draft, lat: ll.lat, lng: ll.lng });
          },
          dragend(e) {
            const ll = (e.target as L.Marker).getLatLng();
            onChange({ ...draft, lat: ll.lat, lng: ll.lng });
          },
        }}
      />

      <Marker
        position={[handlePos.lat, handlePos.lng]}
        icon={resizeHandleIcon()}
        draggable
        zIndexOffset={1300}
        eventHandlers={{
          drag(e) {
            const ll = (e.target as L.Marker).getLatLng();
            // Distance from center → new radius / half-side
            const dn = (ll.lat - draft.lat) * 111_320;
            const cos = Math.cos((draft.lat * Math.PI) / 180);
            const de = (ll.lng - draft.lng) * 111_320 * Math.max(0.2, cos);
            const next = Math.round(Math.min(2000, Math.max(40, Math.hypot(dn, de))));
            onChange({ ...draft, radiusM: next });
          },
          dragend(e) {
            const ll = (e.target as L.Marker).getLatLng();
            const dn = (ll.lat - draft.lat) * 111_320;
            const cos = Math.cos((draft.lat * Math.PI) / 180);
            const de = (ll.lng - draft.lng) * 111_320 * Math.max(0.2, cos);
            const next = Math.round(Math.min(2000, Math.max(40, Math.hypot(dn, de))));
            onChange({ ...draft, radiusM: next });
          },
        }}
      />
    </>
  );
}

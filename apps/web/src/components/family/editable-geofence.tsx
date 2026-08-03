"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
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
    html: `<div style="width:22px;height:22px;border-radius:6px;background:#fff;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:nwse-resize;touch-action:none"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const PATH: L.PathOptions = {
  color: "#0f172a",
  fillColor: "#0f172a",
  fillOpacity: 0.16,
  weight: 3,
};

/**
 * Imperative geofence editor — drag updates Leaflet layers directly so resize
 * stays fluid (React-controlled Marker positions were fighting the finger).
 */
export function EditableGeofence({
  draft,
  onChange,
}: {
  draft: EditableGeofenceDraft;
  onChange: (next: EditableGeofenceDraft) => void;
}) {
  const map = useMap();
  const draftRef = useRef(draft);
  const onChangeRef = useRef(onChange);
  const dragging = useRef(false);
  const emitRaf = useRef<number | null>(null);

  draftRef.current = draft;
  onChangeRef.current = onChange;

  useEffect(() => {
    map.flyTo([draft.lat, draft.lng], Math.max(map.getZoom(), 15), { duration: 0.35 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, draft.id]);

  useEffect(() => {
    const group = L.layerGroup().addTo(map);

    let circle: L.Circle | null = null;
    let rect: L.Rectangle | null = null;

    const center = L.marker([draftRef.current.lat, draftRef.current.lng], {
      icon: centerIcon(),
      draggable: true,
      zIndexOffset: 1200,
      autoPan: false,
    }).addTo(group);

    const handleStart = offsetLatLngMeters(
      draftRef.current.lat,
      draftRef.current.lng,
      0,
      draftRef.current.radiusM
    );
    const handle = L.marker([handleStart.lat, handleStart.lng], {
      icon: resizeHandleIcon(),
      draggable: true,
      zIndexOffset: 1300,
      autoPan: false,
    }).addTo(group);

    function paintShape(d: EditableGeofenceDraft) {
      if (d.shape === "square") {
        const b = squareBounds(d.lat, d.lng, d.radiusM);
        if (circle) {
          group.removeLayer(circle);
          circle = null;
        }
        if (!rect) {
          rect = L.rectangle(b, PATH).addTo(group);
        } else {
          rect.setBounds(b);
        }
      } else {
        if (rect) {
          group.removeLayer(rect);
          rect = null;
        }
        if (!circle) {
          circle = L.circle([d.lat, d.lng], { ...PATH, radius: d.radiusM }).addTo(group);
        } else {
          circle.setLatLng([d.lat, d.lng]);
          circle.setRadius(d.radiusM);
        }
      }
    }

    function syncHandle(d: EditableGeofenceDraft) {
      const pos = offsetLatLngMeters(d.lat, d.lng, 0, d.radiusM);
      handle.setLatLng([pos.lat, pos.lng]);
    }

    function emit(next: EditableGeofenceDraft, immediate = false) {
      draftRef.current = next;
      const fire = () => onChangeRef.current(next);
      if (immediate) {
        if (emitRaf.current != null) cancelAnimationFrame(emitRaf.current);
        emitRaf.current = null;
        fire();
        return;
      }
      if (emitRaf.current != null) return;
      emitRaf.current = requestAnimationFrame(() => {
        emitRaf.current = null;
        fire();
      });
    }

    function radiusFromHandle(ll: L.LatLng, d: EditableGeofenceDraft) {
      const dn = (ll.lat - d.lat) * 111_320;
      const cos = Math.cos((d.lat * Math.PI) / 180);
      const de = (ll.lng - d.lng) * 111_320 * Math.max(0.2, cos);
      return Math.min(2000, Math.max(40, Math.hypot(dn, de)));
    }

    paintShape(draftRef.current);

    center.on("dragstart", () => {
      dragging.current = true;
      map.dragging.disable();
    });
    center.on("drag", () => {
      const ll = center.getLatLng();
      const next = { ...draftRef.current, lat: ll.lat, lng: ll.lng };
      paintShape(next);
      syncHandle(next);
      emit(next);
    });
    center.on("dragend", () => {
      dragging.current = false;
      map.dragging.enable();
      const ll = center.getLatLng();
      const next = {
        ...draftRef.current,
        lat: ll.lat,
        lng: ll.lng,
        radiusM: Math.round(draftRef.current.radiusM),
      };
      paintShape(next);
      syncHandle(next);
      emit(next, true);
    });

    handle.on("dragstart", () => {
      dragging.current = true;
      map.dragging.disable();
    });
    handle.on("drag", () => {
      const ll = handle.getLatLng();
      const next = {
        ...draftRef.current,
        radiusM: radiusFromHandle(ll, draftRef.current),
      };
      // Keep handle under the finger — don't snap back to east-axis during drag.
      paintShape(next);
      emit(next);
    });
    handle.on("dragend", () => {
      dragging.current = false;
      map.dragging.enable();
      const ll = handle.getLatLng();
      const next = {
        ...draftRef.current,
        radiusM: Math.round(radiusFromHandle(ll, draftRef.current)),
      };
      paintShape(next);
      syncHandle(next);
      emit(next, true);
    });

    return () => {
      if (emitRaf.current != null) cancelAnimationFrame(emitRaf.current);
      map.dragging.enable();
      group.clearLayers();
      map.removeLayer(group);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, draft.id, draft.shape]);

  return null;
}

/** Remounts the imperative editor when place or shape changes. */
export function EditableGeofenceLayer({
  draft,
  onChange,
}: {
  draft: EditableGeofenceDraft;
  onChange: (next: EditableGeofenceDraft) => void;
}) {
  return <EditableGeofence key={`${draft.id}-${draft.shape}`} draft={draft} onChange={onChange} />;
}

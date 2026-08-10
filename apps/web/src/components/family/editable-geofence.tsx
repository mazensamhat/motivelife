"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { FamilyPlaceShape } from "@forward/shared";
import {
  normalizeRotationDeg,
  offsetLatLngMeters,
  rotationDegFromHandle,
  squarePolygonLatLngs,
  squareResizeHandleLatLng,
  squareRotateHandleLatLng,
} from "@/lib/family-map/geofence";

export type EditableGeofenceDraft = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  shape: FamilyPlaceShape;
  /** Square only — degrees counter-clockwise from axis-aligned. */
  rotationDeg: number;
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

function rotateHandleIcon() {
  return L.divIcon({
    className: "geofence-rotate-handle",
    html: `<div title="Drag to rotate" style="width:26px;height:26px;border-radius:999px;background:#fff7ed;border:2px solid #ea580c;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;color:#c2410c;font-weight:800">↻</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
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
 * Squares get a white resize handle + orange rotate handle.
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
  const centerRef = useRef<L.Marker | null>(null);
  const apiRef = useRef<{
    paint: (d: EditableGeofenceDraft) => void;
    sync: (d: EditableGeofenceDraft) => void;
  } | null>(null);

  draftRef.current = draft;
  onChangeRef.current = onChange;

  useEffect(() => {
    map.flyTo([draft.lat, draft.lng], Math.max(map.getZoom(), 15), { duration: 0.35 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, draft.id]);

  // Slider / external draft edits — keep polygon in sync when not finger-dragging.
  useEffect(() => {
    if (dragging.current) return;
    const api = apiRef.current;
    if (!api) return;
    api.paint(draft);
    api.sync(draft);
    centerRef.current?.setLatLng([draft.lat, draft.lng]);
  }, [draft.lat, draft.lng, draft.radiusM, draft.rotationDeg, draft.shape]);

  useEffect(() => {
    const group = L.layerGroup().addTo(map);

    let circle: L.Circle | null = null;
    let poly: L.Polygon | null = null;

    const center = L.marker([draftRef.current.lat, draftRef.current.lng], {
      icon: centerIcon(),
      draggable: true,
      zIndexOffset: 1200,
      autoPan: false,
    }).addTo(group);
    centerRef.current = center;

    const resizeStart = squareResizeHandleLatLng(
      draftRef.current.lat,
      draftRef.current.lng,
      draftRef.current.radiusM,
      draftRef.current.rotationDeg
    );
    const resizeHandle = L.marker([resizeStart.lat, resizeStart.lng], {
      icon: resizeHandleIcon(),
      draggable: true,
      zIndexOffset: 1300,
      autoPan: false,
    }).addTo(group);

    const rotateStart = squareRotateHandleLatLng(
      draftRef.current.lat,
      draftRef.current.lng,
      draftRef.current.radiusM,
      draftRef.current.rotationDeg
    );
    const rotateHandle = L.marker([rotateStart.lat, rotateStart.lng], {
      icon: rotateHandleIcon(),
      draggable: true,
      zIndexOffset: 1310,
      autoPan: false,
    });

    function paintShape(d: EditableGeofenceDraft) {
      if (d.shape === "square") {
        const latlngs = squarePolygonLatLngs(d.lat, d.lng, d.radiusM, d.rotationDeg);
        if (circle) {
          group.removeLayer(circle);
          circle = null;
        }
        if (!poly) {
          poly = L.polygon(latlngs, PATH).addTo(group);
        } else {
          poly.setLatLngs(latlngs);
        }
        if (!group.hasLayer(rotateHandle)) rotateHandle.addTo(group);
      } else {
        if (poly) {
          group.removeLayer(poly);
          poly = null;
        }
        if (group.hasLayer(rotateHandle)) group.removeLayer(rotateHandle);
        if (!circle) {
          circle = L.circle([d.lat, d.lng], { ...PATH, radius: d.radiusM }).addTo(group);
        } else {
          circle.setLatLng([d.lat, d.lng]);
          circle.setRadius(d.radiusM);
        }
      }
    }

    function syncHandles(d: EditableGeofenceDraft) {
      if (d.shape === "square") {
        const resize = squareResizeHandleLatLng(d.lat, d.lng, d.radiusM, d.rotationDeg);
        resizeHandle.setLatLng([resize.lat, resize.lng]);
        const rotate = squareRotateHandleLatLng(d.lat, d.lng, d.radiusM, d.rotationDeg);
        rotateHandle.setLatLng([rotate.lat, rotate.lng]);
      } else {
        const pos = offsetLatLngMeters(d.lat, d.lng, 0, d.radiusM);
        resizeHandle.setLatLng([pos.lat, pos.lng]);
      }
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
      return Math.min(2000, Math.max(10, Math.hypot(dn, de)));
    }

    paintShape(draftRef.current);
    syncHandles(draftRef.current);
    apiRef.current = { paint: paintShape, sync: syncHandles };

    center.on("dragstart", () => {
      dragging.current = true;
      map.dragging.disable();
    });
    center.on("drag", () => {
      const ll = center.getLatLng();
      const next = { ...draftRef.current, lat: ll.lat, lng: ll.lng };
      paintShape(next);
      syncHandles(next);
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
        rotationDeg: Math.round(normalizeRotationDeg(draftRef.current.rotationDeg)),
      };
      paintShape(next);
      syncHandles(next);
      emit(next, true);
    });

    resizeHandle.on("dragstart", () => {
      dragging.current = true;
      map.dragging.disable();
    });
    resizeHandle.on("drag", () => {
      const ll = resizeHandle.getLatLng();
      const next = {
        ...draftRef.current,
        radiusM: radiusFromHandle(ll, draftRef.current),
      };
      paintShape(next);
      if (next.shape === "square") {
        const rotate = squareRotateHandleLatLng(
          next.lat,
          next.lng,
          next.radiusM,
          next.rotationDeg
        );
        rotateHandle.setLatLng([rotate.lat, rotate.lng]);
      }
      emit(next);
    });
    resizeHandle.on("dragend", () => {
      dragging.current = false;
      map.dragging.enable();
      const ll = resizeHandle.getLatLng();
      const next = {
        ...draftRef.current,
        radiusM: Math.round(radiusFromHandle(ll, draftRef.current)),
      };
      paintShape(next);
      syncHandles(next);
      emit(next, true);
    });

    rotateHandle.on("dragstart", () => {
      dragging.current = true;
      map.dragging.disable();
    });
    rotateHandle.on("drag", () => {
      const ll = rotateHandle.getLatLng();
      const d = draftRef.current;
      const next = {
        ...d,
        rotationDeg: rotationDegFromHandle(d.lat, d.lng, ll.lat, ll.lng),
      };
      paintShape(next);
      const resize = squareResizeHandleLatLng(
        next.lat,
        next.lng,
        next.radiusM,
        next.rotationDeg
      );
      resizeHandle.setLatLng([resize.lat, resize.lng]);
      emit(next);
    });
    rotateHandle.on("dragend", () => {
      dragging.current = false;
      map.dragging.enable();
      const ll = rotateHandle.getLatLng();
      const d = draftRef.current;
      const next = {
        ...d,
        rotationDeg: Math.round(rotationDegFromHandle(d.lat, d.lng, ll.lat, ll.lng)),
      };
      paintShape(next);
      syncHandles(next);
      emit(next, true);
    });

    return () => {
      if (emitRaf.current != null) cancelAnimationFrame(emitRaf.current);
      apiRef.current = null;
      centerRef.current = null;
      try {
        if (map.dragging) map.dragging.enable();
        group.clearLayers();
        if (map.getContainer()) map.removeLayer(group);
      } catch {
        // Map may already be destroyed when remounting geofence editor.
      }
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
  return (
    <EditableGeofence
      key={`${draft.id}-${draft.shape}`}
      draft={draft}
      onChange={onChange}
    />
  );
}

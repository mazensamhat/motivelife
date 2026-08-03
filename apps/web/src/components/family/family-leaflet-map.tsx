"use client";

import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FamilyMapMemberView, FamilyPlaceView } from "@forward/shared";
import type { LocalHistoryPathPoint } from "@/lib/family-map/local-history-types";
import {
  EditableGeofence,
  type EditableGeofenceDraft,
} from "@/components/family/editable-geofence";
import "leaflet/dist/leaflet.css";

function MapClickHandler({
  enabled,
  onMapClick,
}: {
  enabled: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled || !onMapClick) return;
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function draftPinIcon() {
  return L.divIcon({
    className: "family-draft-pin",
    html: `<div style="width:28px;height:28px;border-radius:999px;background:#0ea5e9;border:3px solid #fff;box-shadow:0 2px 10px rgba(14,165,233,.55)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function MapResizeFix({ resizeKey }: { resizeKey: string }) {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const t1 = setTimeout(fix, 40);
    const t2 = setTimeout(fix, 200);
    const t3 = setTimeout(fix, 500);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", fix);
    };
  }, [map, resizeKey]);
  return null;
}

function FitBounds({
  fitKey,
  points,
  bottomPad,
}: {
  fitKey: string;
  points: Array<{ lat: number; lng: number }>;
  bottomPad: number;
}) {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === fitKey) return;
    last.current = fitKey;
    if (points.length === 0) {
      map.setView([43.65, -79.38], 12, { animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], 14, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, {
      paddingTopLeft: [28, 72],
      paddingBottomRight: [28, bottomPad],
      maxZoom: 15,
      animate: false,
    });
  }, [fitKey, map, points, bottomPad]);
  return null;
}

function FlyToSelected({
  member,
  follow,
}: {
  member: FamilyMapMemberView | null;
  follow: boolean;
}) {
  const map = useMap();
  const lastId = useRef<string | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!member || member.lat == null || member.lng == null) return;
    const idChanged = lastId.current !== member.id;
    lastId.current = member.id;
    if (!follow && !idChanged) return;

    const prev = lastPos.current;
    lastPos.current = { lat: member.lat, lng: member.lng };

    // Ignore tiny GPS jitter while following — that made the map feel possessed.
    if (follow && !idChanged && prev) {
      const dn = (member.lat - prev.lat) * 111_320;
      const cos = Math.cos((member.lat * Math.PI) / 180);
      const de = (member.lng - prev.lng) * 111_320 * Math.max(0.2, cos);
      if (Math.hypot(dn, de) < 18) return;
    }

    const zoom =
      member.presence === "driving" || member.presence === "moving"
        ? Math.max(map.getZoom(), 15)
        : Math.max(map.getZoom(), 14);
    if (follow && !idChanged) {
      map.panTo([member.lat, member.lng], { animate: true, duration: 0.35 });
      return;
    }
    map.flyTo([member.lat, member.lng], zoom, { duration: 0.45 });
  }, [map, follow, member?.id, member?.lat, member?.lng, member?.presence]);
  return null;
}

function FitRoute({
  path,
}: {
  path: LocalHistoryPathPoint[] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!path || path.length < 2) return;
    const bounds = L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15,
      animate: true,
    });
  }, [map, path]);
  return null;
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function memberIcon(
  color: string,
  name: string,
  selected: boolean,
  avatarUrl: string | null
) {
  const size = selected ? 44 : 38;
  const initial = name.slice(0, 1).toUpperCase();
  const label = name.length > 10 ? `${name.slice(0, 9)}…` : name;
  const face =
    avatarUrl && avatarUrl.startsWith("data:image/")
      ? `<img class="family-pin-photo" src="${escapeAttr(avatarUrl)}" alt="" width="${size}" height="${size}" />`
      : escapeAttr(initial);
  return L.divIcon({
    className: "family-member-marker",
    html: `<div class="family-pin-wrap${selected ? " is-selected" : ""}">
      <div class="family-pin-avatar" style="width:${size}px;height:${size}px;background:${escapeAttr(color)}">${face}</div>
      <div class="family-pin-label">${escapeAttr(label)}</div>
    </div>`,
    iconSize: [size + 8, size + 28],
    iconAnchor: [(size + 8) / 2, size / 2],
  });
}

function placeIcon(name: string) {
  return L.divIcon({
    className: "family-place-marker",
    html: `<div class="family-place-chip">${name}</div>`,
    iconSize: [80, 24],
    iconAnchor: [40, 12],
  });
}

function endpointIcon(label: "A" | "B", color: string) {
  return L.divIcon({
    className: "family-route-endpoint",
    html: `<div style="width:26px;height:26px;border-radius:999px;background:${color};color:#fff;font:700 12px/26px system-ui,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export type HistoryPlaceHighlight = {
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
};

export default function FamilyLeafletMap({
  members,
  places,
  selectedMemberId,
  onSelectMember,
  followSelected = false,
  selectedPlaceId = null,
  onSelectPlace,
  editingGeofence = null,
  onGeofenceChange,
  /** When true, hide member pins / other place chips so only the geofence is editable. */
  focusGeofenceOnly = false,
  onMapClick,
  draftPin = null,
  expanded,
  layoutKey = "",
  bottomPad = 160,
  routePath = null,
  visitedPlaces = null,
}: {
  members: FamilyMapMemberView[];
  places: FamilyPlaceView[];
  selectedMemberId: string | null;
  onSelectMember: (id: string) => void;
  /** Keep camera locked on the selected member as they move (Life360-style). */
  followSelected?: boolean;
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string) => void;
  editingGeofence?: EditableGeofenceDraft | null;
  onGeofenceChange?: (next: EditableGeofenceDraft) => void;
  focusGeofenceOnly?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  draftPin?: { lat: number; lng: number } | null;
  expanded: boolean;
  layoutKey?: string;
  bottomPad?: number;
  routePath?: LocalHistoryPathPoint[] | null;
  visitedPlaces?: HistoryPlaceHighlight[] | null;
}) {
  const selected = members.find((m) => m.id === selectedMemberId) ?? null;

  const points = useMemo(() => {
    if (routePath && routePath.length >= 2) {
      return routePath.map((p) => ({ lat: p.lat, lng: p.lng }));
    }
    if (visitedPlaces && visitedPlaces.length > 0) {
      return visitedPlaces.map((p) => ({ lat: p.lat, lng: p.lng }));
    }
    const fromMembers = members
      .filter((m) => m.lat != null && m.lng != null)
      .map((m) => ({ lat: m.lat!, lng: m.lng! }));
    if (fromMembers.length) return fromMembers;
    return places.map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [members, places, routePath, visitedPlaces]);

  // Stable fit key — do NOT include sheet overlay layoutKey (that was resetting
  // the map to the city center every time place settings opened/closed).
  const fitKey = useMemo(
    () =>
      [
        expanded ? "exp" : "norm",
        routePath?.length ? `route-${routePath.length}-${routePath[0]?.t}` : "live",
        visitedPlaces?.length ? `vis-${visitedPlaces.map((p) => p.name).join(",")}` : "",
        ...members.map((m) => m.id),
        ...places.map((p) => p.id),
      ].join("|"),
    [expanded, members, places, routePath, visitedPlaces]
  );

  // Resize-only key — invalidate when overlays open/close without re-fitting bounds.
  const resizeKey = useMemo(
    () => `${expanded ? "exp" : "norm"}|${layoutKey}`,
    [expanded, layoutKey]
  );

  const center = points[0] ?? { lat: 43.65, lng: -79.38 };
  const routeLatLngs = useMemo(
    () => (routePath ?? []).map((p) => [p.lat, p.lng] as [number, number]),
    [routePath]
  );

  return (
    <div className="family-live-map h-full min-h-[320px] w-full bg-[#e8eef5]">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100%", width: "100%", minHeight: 320 }}
      >
        {/* Light, street-readable tiles — Life360-like clarity */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        <MapResizeFix resizeKey={resizeKey} />
        <MapClickHandler
          enabled={!routePath?.length && !editingGeofence}
          onMapClick={onMapClick}
        />
        {!routePath?.length && !editingGeofence && !followSelected && !focusGeofenceOnly ? (
          <FitBounds fitKey={fitKey} points={points} bottomPad={bottomPad} />
        ) : (
          <FitRoute path={routePath} />
        )}
        {!routePath?.length && !editingGeofence && !focusGeofenceOnly ? (
          <FlyToSelected member={selected} follow={followSelected} />
        ) : null}

        {editingGeofence && onGeofenceChange ? (
          <EditableGeofence draft={editingGeofence} onChange={onGeofenceChange} />
        ) : null}

        {draftPin ? (
          <Marker
            position={[draftPin.lat, draftPin.lng]}
            icon={draftPinIcon()}
            interactive={false}
            zIndexOffset={800}
          />
        ) : null}

        {routeLatLngs.length >= 2 ? (
          <>
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: "#0ea5e9",
                weight: 5,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Marker
              position={routeLatLngs[0]!}
              icon={endpointIcon("A", "#0f172a")}
              interactive={false}
            />
            <Marker
              position={routeLatLngs[routeLatLngs.length - 1]!}
              icon={endpointIcon("B", "#0284c7")}
              interactive={false}
            />
          </>
        ) : null}

        {/* Live map: place name chips only. Geofence shapes render only while editing
            (or in history highlights) — always-on squares/circles flashed and felt glitchy. */}
        {!focusGeofenceOnly && !editingGeofence
          ? (visitedPlaces ?? []).map((v) => (
              <Circle
                key={`vh-${v.name}-${v.lat}`}
                center={[v.lat, v.lng]}
                radius={v.radiusM}
                pathOptions={{
                  color: "#ea580c",
                  fillColor: "#ea580c",
                  fillOpacity: 0.18,
                  weight: 2,
                }}
              />
            ))
          : null}

        {!focusGeofenceOnly
          ? places.map((place) => {
              if (editingGeofence?.id === place.id) return null;
              return (
                <Marker
                  key={`p-${place.id}`}
                  position={[place.lat, place.lng]}
                  icon={placeIcon(place.name)}
                  eventHandlers={
                    onSelectPlace
                      ? {
                          click: (e) => {
                            L.DomEvent.stopPropagation(e);
                            onSelectPlace(place.id);
                          },
                        }
                      : undefined
                  }
                />
              );
            })
          : null}

        {!focusGeofenceOnly
          ? members.map((member) => {
              if (member.lat == null || member.lng == null) return null;
              return (
                <Marker
                  key={member.id}
                  position={[member.lat, member.lng]}
                  icon={memberIcon(
                    member.color,
                    member.displayName,
                    selectedMemberId === member.id,
                    member.avatarUrl
                  )}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      onSelectMember(member.id);
                    },
                  }}
                />
              );
            })
          : null}
      </MapContainer>
    </div>
  );
}

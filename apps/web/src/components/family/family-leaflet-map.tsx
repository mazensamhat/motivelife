"use client";

import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FamilyMapMemberView, FamilyPlaceView } from "@forward/shared";
import type { LocalHistoryPathPoint } from "@/lib/family-map/local-history-types";
import {
  EditableGeofenceLayer,
  type EditableGeofenceDraft,
} from "@/components/family/editable-geofence";
import { squareBounds } from "@/lib/family-map/geofence";
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

/** Imperative fences — React-Leaflet Circle often fails to unmount on hide. */
function PlaceFencesLayer({
  places,
  enabled,
}: {
  places: FamilyPlaceView[];
  enabled: boolean;
}) {
  const map = useMap();
  const placesKey = places
    .map((p) => `${p.id}:${p.lat}:${p.lng}:${p.radiusM}:${p.shape}`)
    .join("|");

  useEffect(() => {
    if (!enabled) return;

    const group = L.layerGroup().addTo(map);
    const path: L.PathOptions = {
      color: "#334155",
      fillColor: "#64748b",
      fillOpacity: 0.1,
      weight: 1.5,
      dashArray: "4 6",
      interactive: false,
    };

    for (const place of places) {
      if (place.shape === "square") {
        const b = squareBounds(place.lat, place.lng, place.radiusM);
        L.rectangle(b, path).addTo(group);
      } else {
        L.circle([place.lat, place.lng], { ...path, radius: place.radiusM }).addTo(group);
      }
    }

    return () => {
      map.removeLayer(group);
    };
  }, [map, enabled, placesKey, places]);

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
      // Closer default zoom so street labels stay readable on Fold cover screens.
      map.setView([points[0]!.lat, points[0]!.lng], 17, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    const narrow =
      typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 400;
    map.fitBounds(bounds, {
      paddingTopLeft: narrow ? [16, 64] : [28, 72],
      paddingBottomRight: narrow
        ? [16, Math.min(bottomPad, 140)]
        : [28, bottomPad],
      // Allow a closer fit — users can still pinch further (map maxZoom is higher).
      maxZoom: narrow ? 18 : 17,
      animate: false,
    });
  }, [fitKey, map, points, bottomPad]);
  return null;
}

/** Keep Leaflet map maxZoom in sync when switching streets ↔ satellite. */
function MapZoomLimits({ mapStyle }: { mapStyle: "streets" | "satellite" }) {
  const map = useMap();
  useEffect(() => {
    // Satellite: Esri imagery is native to ~19; overzoom past that by stretching tiles.
    // Streets: CARTO Voyager supports high zoom; allow a little overzoom on retina.
    const maxZoom = mapStyle === "satellite" ? 22 : 22;
    map.setMaxZoom(maxZoom);
    if (map.getZoom() > maxZoom) {
      map.setZoom(maxZoom);
    }
  }, [map, mapStyle]);
  return null;
}

function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const dn = (b.lat - a.lat) * 111_320;
  const cos = Math.cos((a.lat * Math.PI) / 180);
  const de = (b.lng - a.lng) * 111_320 * Math.max(0.2, cos);
  return Math.hypot(dn, de);
}

/**
 * Smooth live pins + follow camera. GPS arrives in bursts; we lerp display
 * positions so movement reads continuous instead of pause→teleport→pause.
 */
function SmoothMembersLayer({
  members,
  selectedMemberId,
  followSelected,
  onSelectMember,
}: {
  members: FamilyMapMemberView[];
  selectedMemberId: string | null;
  followSelected: boolean;
  onSelectMember: (id: string) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(
    new Map<
      string,
      {
        marker: L.Marker;
        display: { lat: number; lng: number };
        target: { lat: number; lng: number };
        /** Approx deg/sec from last target jump — used for short dead-reckoning. */
        vx: number | null;
        vy: number | null;
        targetAt: number | null;
        metaKey: string;
      }
    >()
  );
  const followIdRef = useRef<string | null>(null);
  const followSelectedRef = useRef(followSelected);
  const selectedIdRef = useRef(selectedMemberId);
  const rafRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelectMember);

  followSelectedRef.current = followSelected;
  selectedIdRef.current = selectedMemberId;
  onSelectRef.current = onSelectMember;
  followIdRef.current = followSelected ? selectedMemberId : null;

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    groupRef.current = group;

    const scheduleTick = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(tick);
    };

    const tick = () => {
      rafRef.current = null;
      const entries = markersRef.current;
      let moving = false;
      const now = performance.now();
      for (const [, row] of entries) {
        // Dead-reckon between GPS updates so highway pins stay with the car.
        let aim = row.target;
        if (row.vx != null && row.vy != null && row.targetAt != null) {
          const ageSec = Math.min(4.2, (now - row.targetAt) / 1000);
          if (ageSec > 0.04) {
            // Ease prediction so we don't overshoot when the next fix arrives late.
            const damp = Math.pow(0.92, ageSec);
            aim = {
              lat: row.target.lat + row.vy * ageSec * damp,
              lng: row.target.lng + row.vx * ageSec * damp,
            };
          }
        }
        const dist = metersBetween(row.display, aim);
        if (dist < 0.25) {
          row.display = { ...aim };
          // Keep ticking while dead-reckoning / following so motion stays continuous.
          if (row.vx != null || followIdRef.current) moving = true;
          continue;
        }
        moving = true;
        // Aggressive chase — lagging behind another driver is the worst UX.
        const alpha =
          dist > 100 ? 0.62 : dist > 40 ? 0.48 : dist > 14 ? 0.34 : 0.24;
        row.display = {
          lat: row.display.lat + (aim.lat - row.display.lat) * alpha,
          lng: row.display.lng + (aim.lng - row.display.lng) * alpha,
        };
        try {
          row.marker.setLatLng([row.display.lat, row.display.lng]);
        } catch {
          // Marker/map may be mid-teardown.
        }
      }

      const followId = followIdRef.current;
      if (followId) {
        const row = entries.get(followId);
        if (row) {
          const center = map.getCenter();
          const camDist = metersBetween(
            { lat: center.lat, lng: center.lng },
            row.display
          );
          if (camDist > 1.5) {
            const camAlpha = camDist > 60 ? 0.55 : camDist > 18 ? 0.38 : 0.26;
            const nextLat = center.lat + (row.display.lat - center.lat) * camAlpha;
            const nextLng = center.lng + (row.display.lng - center.lng) * camAlpha;
            map.setView([nextLat, nextLng], map.getZoom(), { animate: false });
            moving = true;
          }
        }
      }

      if (moving && !document.hidden) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const onVisibility = () => {
      if (!document.hidden) scheduleTick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    scheduleTick();
    // Expose kick so member updates can restart a paused RAF.
    (group as L.LayerGroup & { __kickSmooth?: () => void }).__kickSmooth = scheduleTick;

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        group.clearLayers();
        if (map.getContainer()) {
          map.removeLayer(group);
        }
      } catch {
        // Map may already be torn down on remount / navigate away.
      }
      markersRef.current.clear();
      groupRef.current = null;
    };
  }, [map]);

  const followEngageRef = useRef<string | null>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const live = new Set<string>();

    for (const member of members) {
      if (member.lat == null || member.lng == null) continue;
      live.add(member.id);
      const selected = selectedMemberId === member.id;
      const metaKey = [
        member.color,
        member.displayName,
        selected ? "1" : "0",
        member.avatarUrl ?? "",
        member.presence,
        member.speedKmh != null ? Math.round(member.speedKmh) : "",
      ].join("|");

      const existing = markersRef.current.get(member.id);
      if (!existing) {
        const marker = L.marker([member.lat, member.lng], {
          icon: memberIcon(
            member.color,
            member.displayName,
            selected,
            member.avatarUrl,
            member.presence,
            member.speedKmh
          ),
          zIndexOffset: selected ? 700 : 400,
        }).addTo(group);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(member.id);
        });
        markersRef.current.set(member.id, {
          marker,
          display: { lat: member.lat, lng: member.lng },
          target: { lat: member.lat, lng: member.lng },
          vx: null,
          vy: null,
          targetAt: performance.now(),
          metaKey,
        });
        continue;
      }

      const prevTarget = existing.target;
      const prevAt = existing.targetAt;
      const nextTarget = { lat: member.lat, lng: member.lng };
      const jumpM = metersBetween(existing.display, nextTarget);

      const driving =
        member.presence === "driving" ||
        (member.speedKmh != null && member.speedKmh >= 20);

      // Self pin, big jumps, or driving catch-up: snap so we never trail behind.
      if (member.isYou || jumpM > 90 || (driving && jumpM > 45)) {
        existing.display = { ...nextTarget };
        existing.target = nextTarget;
        if (prevAt != null && jumpM > 2 && jumpM < 250) {
          const dt = Math.max(0.25, (performance.now() - prevAt) / 1000);
          existing.vx = (nextTarget.lng - prevTarget.lng) / dt;
          existing.vy = (nextTarget.lat - prevTarget.lat) / dt;
        } else {
          existing.vx = null;
          existing.vy = null;
        }
        existing.targetAt = performance.now();
        existing.marker.setLatLng([existing.display.lat, existing.display.lng]);
        const kick = (
          group as L.LayerGroup & { __kickSmooth?: () => void }
        ).__kickSmooth;
        kick?.();
      } else {
        if (prevAt != null) {
          const dt = Math.max(0.2, (performance.now() - prevAt) / 1000);
          existing.vx = (nextTarget.lng - prevTarget.lng) / dt;
          existing.vy = (nextTarget.lat - prevTarget.lat) / dt;
        }
        existing.target = nextTarget;
        existing.targetAt = performance.now();
        if (jumpM >= 0.25) {
          const kick = (
            group as L.LayerGroup & { __kickSmooth?: () => void }
          ).__kickSmooth;
          kick?.();
        }
      }

      if (existing.metaKey !== metaKey) {
        existing.marker.setIcon(
          memberIcon(
            member.color,
            member.displayName,
            selected,
            member.avatarUrl,
            member.presence,
            member.speedKmh
          )
        );
        existing.marker.setZIndexOffset(selected ? 700 : 400);
        existing.metaKey = metaKey;
      }
    }

    for (const [id, row] of markersRef.current) {
      if (live.has(id)) continue;
      group.removeLayer(row.marker);
      markersRef.current.delete(id);
    }

    // Frame once when follow engages or the selected person changes — not every GPS tick.
    const engageKey =
      followSelected && selectedMemberId ? selectedMemberId : null;
    if (engageKey && followEngageRef.current !== engageKey) {
      followEngageRef.current = engageKey;
      const row = markersRef.current.get(engageKey);
      const member = members.find((m) => m.id === engageKey);
      if (row && member) {
        const zoom =
          member.presence === "driving" || member.presence === "moving"
            ? Math.max(map.getZoom(), 16)
            : Math.max(map.getZoom(), 17);
        map.setView([row.display.lat, row.display.lng], zoom, { animate: true });
      }
    } else if (!engageKey) {
      followEngageRef.current = null;
    }
  }, [map, members, selectedMemberId, followSelected]);

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
    const pts = path.filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        !(p.lat === 0 && p.lng === 0)
    );
    if (pts.length < 2) return;
    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number]));
    // Refit after history collapses / map grows so bounds use the real size.
    const run = () => {
      try {
        map.invalidateSize({ animate: false });
        map.fitBounds(bounds, {
          padding: [36, 36],
          maxZoom: 18,
          animate: true,
        });
      } catch {
        // map may be mid-teardown
      }
    };
    run();
    const t1 = window.setTimeout(run, 120);
    const t2 = window.setTimeout(run, 320);
    const t3 = window.setTimeout(run, 560);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [
    map,
    path,
    path?.[0]?.lat,
    path?.[0]?.lng,
    path?.[path.length - 1]?.lat,
    path?.[path.length - 1]?.lng,
    path?.length,
  ]);
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
  avatarUrl: string | null,
  presence: string | null | undefined,
  speedKmh: number | null | undefined
) {
  const size = selected ? 46 : 38;
  const initial = name.slice(0, 1).toUpperCase();
  const label = name.length > 10 ? `${name.slice(0, 9)}…` : name;
  const face =
    avatarUrl && avatarUrl.startsWith("data:image/")
      ? `<img class="family-pin-photo" src="${escapeAttr(avatarUrl)}" alt="" width="${size}" height="${size}" />`
      : escapeAttr(initial);

  const moving = presence === "driving" || presence === "moving";
  const showSpeed =
    moving && speedKmh != null && Number.isFinite(speedKmh) && speedKmh >= 1;
  const badgeClass =
    presence === "driving"
      ? "family-pin-badge is-drive"
      : presence === "moving"
        ? "family-pin-badge is-walk"
        : "";
  const badgeInner =
    presence === "driving"
      ? showSpeed
        ? `${Math.round(speedKmh!)}`
        : "🚗"
      : presence === "moving"
        ? showSpeed
          ? `${Math.round(speedKmh!)}`
          : "👟"
        : "";
  const badgeHtml = badgeClass
    ? `<div class="${badgeClass}" title="${escapeAttr(
        presence === "driving" ? "Driving" : "Walking"
      )}">${badgeInner}${
        showSpeed ? `<span class="family-pin-badge-unit">km/h</span>` : ""
      }</div>`
    : "";

  return L.divIcon({
    className: "family-member-marker",
    html: `<div class="family-pin-wrap${selected ? " is-selected" : ""}${
      moving ? " is-active" : ""
    }">
      <div class="family-pin-avatar-stack">
        ${badgeHtml}
        <div class="family-pin-avatar" style="width:${size}px;height:${size}px;background:${escapeAttr(color)}">${face}</div>
      </div>
      <div class="family-pin-label">${escapeAttr(label)}</div>
    </div>`,
    iconSize: [Math.max(size + 28, 72), size + 36],
    iconAnchor: [Math.max(size + 28, 72) / 2, size / 2 + 4],
  });
}

function placeIcon(name: string, ghost = false) {
  const chipClass = ghost ? "family-place-chip family-place-chip--ghost" : "family-place-chip";
  return L.divIcon({
    className: "family-place-marker",
    html: `<div class="${chipClass}">${name}</div>`,
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
  mapStyle = "streets",
  showPlaceFences = false,
  placeLabelsMode = "ghost",
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
  mapStyle?: "streets" | "satellite";
  /** Opt-in layer: draw saved place geofence rings on the live map. */
  showPlaceFences?: boolean;
  /**
   * Saved-place name chips on the map (visual only — places stay saved either way).
   * off = hidden · ghost = very transparent · on = full labels
   */
  placeLabelsMode?: "off" | "ghost" | "on";
}) {
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
  // Include place-zone toggle so Leaflet fully remounts fence layers on hide/show.
  const resizeKey = useMemo(
    () => `${expanded ? "exp" : "norm"}|${layoutKey}|zones:${showPlaceFences ? 1 : 0}`,
    [expanded, layoutKey, showPlaceFences]
  );

  const center = points[0] ?? { lat: 43.65, lng: -79.38 };
  const routeLatLngs = useMemo(() => {
    return (routePath ?? [])
      .filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng) &&
          !(p.lat === 0 && p.lng === 0)
      )
      .map((p) => [p.lat, p.lng] as [number, number]);
  }, [routePath]);

  return (
    <div className="family-live-map h-full min-h-[320px] w-full bg-[#e8eef5]">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        maxZoom={22}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100%", width: "100%", minHeight: 320 }}
      >
        {/* Light streets or satellite — Life360-style layer toggle */}
        {mapStyle === "satellite" ? (
          <>
            <TileLayer
              key="satellite-imagery"
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              // Esri hosts imagery to ~19 worldwide; stretch tiles past that so pinch-zoom
              // doesn't hard-stop (grey / "not available" tiles).
              maxNativeZoom={19}
              maxZoom={22}
            />
            <TileLayer
              key="satellite-labels"
              attribution=""
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={22}
              opacity={0.9}
            />
          </>
        ) : (
          <TileLayer
            key="streets"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxNativeZoom={20}
            maxZoom={22}
            detectRetina
          />
        )}
        <MapZoomLimits mapStyle={mapStyle} />
        <MapResizeFix resizeKey={resizeKey} />
        <MapClickHandler
          enabled={!routePath?.length && !editingGeofence}
          onMapClick={onMapClick}
        />
        {!routePath?.length && !editingGeofence && !followSelected && !focusGeofenceOnly ? (
          <FitBounds fitKey={fitKey} points={points} bottomPad={bottomPad} />
        ) : routePath && routePath.length >= 2 ? (
          <FitRoute path={routePath} />
        ) : null}

        {!focusGeofenceOnly ? (
          <SmoothMembersLayer
            members={members}
            selectedMemberId={selectedMemberId}
            followSelected={followSelected && !editingGeofence && !(routePath && routePath.length >= 2)}
            onSelectMember={onSelectMember}
          />
        ) : null}

        {editingGeofence && onGeofenceChange ? (
          <EditableGeofenceLayer draft={editingGeofence} onChange={onGeofenceChange} />
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

        {/* Stay rings only when history explicitly highlights a stop — never on live overview. */}
        {!focusGeofenceOnly && !editingGeofence
          ? (visitedPlaces ?? []).map((v) => (
              <Circle
                key={`vh-${v.name}-${v.lat}-${v.lng}`}
                center={[v.lat, v.lng]}
                radius={v.radiusM}
                pathOptions={{
                  color: "#0284c7",
                  fillColor: "#0ea5e9",
                  fillOpacity: 0.14,
                  weight: 2,
                }}
              />
            ))
          : null}

        {/* Opt-in place zones — imperative so Hide actually removes Leaflet layers. */}
        <PlaceFencesLayer
          places={places}
          enabled={Boolean(showPlaceFences && !focusGeofenceOnly && !editingGeofence)}
        />

        {!focusGeofenceOnly
          ? places.map((place) => {
              if (editingGeofence?.id === place.id) return null;
              const selected = selectedPlaceId === place.id;
              // Hidden mode: only show the place you’re editing/selecting.
              if (placeLabelsMode === "off" && !selected) return null;
              const ghost = placeLabelsMode === "ghost" && !selected;
              return (
                <Marker
                  key={`p-${place.id}-${placeLabelsMode}`}
                  position={[place.lat, place.lng]}
                  icon={placeIcon(place.name, ghost)}
                  zIndexOffset={selected ? 600 : ghost ? -50 : 0}
                  opacity={
                    selected
                      ? 1
                      : ghost
                        ? 0.35
                        : selectedPlaceId && !selected
                          ? 0.55
                          : 1
                  }
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
      </MapContainer>
    </div>
  );
}

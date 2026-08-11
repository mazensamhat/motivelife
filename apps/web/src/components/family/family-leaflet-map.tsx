"use client";

import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type {
  FamilyDriveImpact,
  FamilyMapMemberView,
  FamilyPlaceView,
} from "@forward/shared";
import type { LocalHistoryPathPoint } from "@/lib/family-map/local-history-types";
import {
  EditableGeofenceLayer,
  type EditableGeofenceDraft,
} from "@/components/family/editable-geofence";
import { DriveRouteOrbsLayer } from "@/components/family/drive-route-orbs";
import { squarePolygonLatLngs } from "@/lib/family-map/geofence";
import { memberPinStatusLabel } from "@/lib/family-map/member-presence-label";
import "leaflet/dist/leaflet.css";

/** Canvas polylines stay glued to tiles in iOS WKWebView; SVG panes drift on pinch-zoom. */
const routeCanvasRenderer =
  typeof window !== "undefined" ? L.canvas({ padding: 0.5 }) : undefined;

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
    const fix = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // Map may be mid-teardown.
      }
    };
    // One deferred pass — four invalidateSize storms fought finger panning.
    const t = window.setTimeout(fix, 120);
    let resizeTimer: number | null = null;
    const onResize = () => {
      if (resizeTimer != null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(fix, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      if (resizeTimer != null) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
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
    .map(
      (p) =>
        `${p.id}:${p.lat}:${p.lng}:${p.radiusM}:${p.shape}:${Math.round(p.rotationDeg ?? 0)}:${Math.round((p.aspectRatio ?? 1) * 100)}`
    )
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
        const latlngs = squarePolygonLatLngs(
          place.lat,
          place.lng,
          place.radiusM,
          place.rotationDeg ?? 0,
          place.aspectRatio ?? 1
        );
        L.polygon(latlngs, path).addTo(group);
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
  home,
}: {
  fitKey: string;
  points: Array<{ lat: number; lng: number }>;
  bottomPad: number;
  home: { lat: number; lng: number; radiusM?: number } | null;
}) {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === fitKey) return;
    last.current = fitKey;
    const narrow =
      typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 400;
    const padTL: [number, number] = narrow ? [16, 64] : [28, 72];
    const padBR: [number, number] = narrow
      ? [16, Math.min(bottomPad, 140)]
      : [28, bottomPad];

    // Life360-style: on open, ease into the family home.
    if (home) {
      const homeRadius = Math.max(home.radiusM ?? 120, 80);
      const nearHome = points.filter((p) => metersBetween(p, home) <= homeRadius * 1.6);
      // Prefer home whenever it exists and anyone is there, or we have no live pins yet.
      const preferHome = points.length === 0 || nearHome.length > 0;
      if (preferHome) {
        const zoom = narrow ? 17 : 16.25;
        try {
          map.flyTo([home.lat, home.lng], zoom, {
            animate: true,
            duration: 1.05,
            easeLinearity: 0.2,
          });
        } catch {
          map.setView([home.lat, home.lng], zoom, { animate: false });
        }
        return;
      }
    }

    if (points.length === 0) {
      map.setView([43.65, -79.38], 12, { animate: false });
      return;
    }
    if (points.length === 1) {
      try {
        map.flyTo([points[0]!.lat, points[0]!.lng], 17, {
          animate: true,
          duration: 0.7,
          easeLinearity: 0.25,
        });
      } catch {
        map.setView([points[0]!.lat, points[0]!.lng], 17, { animate: false });
      }
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    try {
      map.flyToBounds(bounds, {
        paddingTopLeft: padTL,
        paddingBottomRight: padBR,
        maxZoom: narrow ? 18 : 17,
        animate: true,
        duration: 0.75,
        easeLinearity: 0.25,
      });
    } catch {
      map.fitBounds(bounds, {
        paddingTopLeft: padTL,
        paddingBottomRight: padBR,
        maxZoom: narrow ? 18 : 17,
        animate: false,
      });
    }
  }, [fitKey, map, points, bottomPad, home]);
  return null;
}

const CLUSTER_RADIUS_M = 48;

type MemberCluster = {
  key: string;
  lat: number;
  lng: number;
  members: FamilyMapMemberView[];
};

function memberIsMovingForCluster(
  m: FamilyMapMemberView,
  followId: string | null
) {
  // Keep home clusters stable — light indoor GPS wobble shouldn't break the bubble.
  return (
    m.id === followId ||
    m.presence === "driving" ||
    (m.speedKmh != null && m.speedKmh >= 5)
  );
}

/**
 * Life360-style: stationary people within ~50m share one square avatar bubble.
 * Followed / moving members stay as individual pins.
 */
function buildMemberClusters(
  members: FamilyMapMemberView[],
  followId: string | null
): { clusters: MemberCluster[]; clusteredIds: Set<string> } {
  const parked = members
    .filter((m) => m.lat != null && m.lng != null && !memberIsMovingForCluster(m, followId))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const used = new Set<string>();
  const clusters: MemberCluster[] = [];
  const clusteredIds = new Set<string>();

  for (const seed of parked) {
    if (used.has(seed.id)) continue;
    const group = [seed];
    used.add(seed.id);
    for (const other of parked) {
      if (used.has(other.id)) continue;
      if (
        metersBetween(
          { lat: seed.lat!, lng: seed.lng! },
          { lat: other.lat!, lng: other.lng! }
        ) <= CLUSTER_RADIUS_M
      ) {
        group.push(other);
        used.add(other.id);
      }
    }
    if (group.length < 2) continue;
    const lat = group.reduce((s, g) => s + g.lat!, 0) / group.length;
    const lng = group.reduce((s, g) => s + g.lng!, 0) / group.length;
    const key = group
      .map((g) => g.id)
      .sort()
      .join("+");
    clusters.push({ key, lat, lng, members: group });
    for (const g of group) clusteredIds.add(g.id);
  }

  return { clusters, clusteredIds };
}

type ClusterZoomTier = "full" | "compact" | "dot";

function clusterZoomTier(zoom: number): ClusterZoomTier {
  if (zoom >= 15.25) return "full";
  if (zoom >= 13) return "compact";
  return "dot";
}

/** Life360 square avatar grid — shrinks to a count-dot when zoomed out. */
function clusterBubbleIcon(
  members: FamilyMapMemberView[],
  selectedMemberId: string | null,
  tier: ClusterZoomTier = "full"
) {
  const atHome = members.some((m) => m.placeCategory === "home");
  const place = members.find((m) => m.placeName)?.placeName;
  const statusLabel = atHome
    ? `${members.length} at Home`
    : place
      ? `${members.length} at ${place}`
      : `${members.length} together`;
  const homeSvg = atHome
    ? `<svg class="family-cluster-home-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.2 3.5 10.2a1 1 0 0 0-.3.7V20a1 1 0 0 0 1 1h5.2v-5.5h5.2V21H20a1 1 0 0 0 1-1v-9.1a1 1 0 0 0-.3-.7L12 3.2Z"/></svg>`
    : "";

  if (tier === "dot") {
    const size = 34;
    return L.divIcon({
      className: "family-cluster-marker",
      html: `<div class="family-cluster-dot${atHome ? " is-home" : ""}" title="${escapeAttr(
        statusLabel
      )}">
        ${homeSvg}<span class="family-cluster-dot-count">${members.length}</span>
      </div>`,
      iconSize: [size, size],
      iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
    });
  }

  const cols = members.length <= 4 ? 2 : Math.min(3, Math.ceil(Math.sqrt(members.length)));
  const cell = tier === "compact" ? (members.length <= 4 ? 28 : 24) : members.length <= 4 ? 40 : 34;
  const gap = tier === "compact" ? 4 : 6;
  const padX = tier === "compact" ? 8 : 10;
  const faces = members
    .map((m) => {
      const initial = m.displayName.slice(0, 1).toUpperCase();
      const selected = selectedMemberId === m.id;
      const face =
        m.avatarUrl &&
        (m.avatarUrl.startsWith("data:image/") ||
          m.avatarUrl.startsWith("https://") ||
          m.avatarUrl.startsWith("http://"))
          ? `<img class="family-cluster-photo" src="${escapeAttr(m.avatarUrl)}" alt="" />`
          : escapeAttr(initial);
      return `<button type="button" class="family-cluster-face${
        selected ? " is-selected" : ""
      }" data-member-id="${escapeAttr(m.id)}" style="width:${cell}px;height:${cell}px;background:${escapeAttr(
        m.color
      )}" aria-label="${escapeAttr(m.displayName)}">${face}</button>`;
    })
    .join("");

  const gridW = cols * cell + (cols - 1) * gap + padX * 2;
  const rows = Math.ceil(members.length / cols);
  const statusH = tier === "compact" ? 22 : 28;
  const gridH = rows * cell + (rows - 1) * gap + statusH + 14;
  return L.divIcon({
    className: "family-cluster-marker",
    html: `<div class="family-cluster-bubble family-cluster-bubble--${tier}" style="--cols:${cols}">
      <div class="family-cluster-status">${homeSvg}<span>${escapeAttr(statusLabel)}</span></div>
      <div class="family-cluster-grid" style="gap:${gap}px">${faces}</div>
    </div>`,
    iconSize: [gridW, gridH],
    iconAnchor: [Math.round(gridW / 2), gridH - 4],
  });
}

/** Keep Leaflet map maxZoom in sync when switching streets ↔ satellite. */
function MapZoomLimits({ mapStyle }: { mapStyle: "streets" | "satellite" }) {
  const map = useMap();
  useEffect(() => {
    // Satellite: Esri imagery is native to ~19; overzoom past that by stretching tiles.
    // Streets: OSM hosts to ~19; allow overzoom on retina / pinch.
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
        /** Only coast/dead-reckon while clearly driving — never while parked. */
        coast: boolean;
        metaKey: string;
      }
    >()
  );
  const clustersRef = useRef(
    new Map<
      string,
      {
        marker: L.Marker;
        metaKey: string;
        lat: number;
        lng: number;
        members: FamilyMapMemberView[];
        tier: ClusterZoomTier;
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
    const draggingRef = { current: false };
    const container = map.getContainer();

    const scheduleTick = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(tick);
    };

    const setDragging = (on: boolean) => {
      draggingRef.current = on;
      container.classList.toggle("is-user-dragging", on);
      if (!on) scheduleTick();
    };

    const tick = () => {
      rafRef.current = null;
      // Finger pan owns the map — skip pin/camera work until dragend.
      if (draggingRef.current) return;
      const entries = markersRef.current;
      let moving = false;
      const now = performance.now();
      const followId = followIdRef.current;
      for (const [, row] of entries) {
        // Coast between GPS fixes — keep short so we don't overshoot then yank.
        let aim = row.target;
        if (
          row.vx != null &&
          row.vy != null &&
          row.targetAt != null &&
          row.coast
        ) {
          const ageSec = Math.min(1.8, (now - row.targetAt) / 1000);
          if (ageSec > 0.04) {
            const damp = Math.pow(0.75, ageSec);
            aim = {
              lat: row.target.lat + row.vy * ageSec * damp,
              lng: row.target.lng + row.vx * ageSec * damp,
            };
          }
        }
        const dist = metersBetween(row.display, aim);
        if (dist < 0.35) {
          if (
            row.display.lat !== aim.lat ||
            row.display.lng !== aim.lng
          ) {
            row.display = { ...aim };
            try {
              row.marker.setLatLng([row.display.lat, row.display.lng]);
            } catch {
              // Marker/map may be mid-teardown.
            }
          }
          // Only keep RAF alive while coasting — follow alone used to spin forever.
          if (row.coast) moving = true;
        } else {
          moving = true;
          // Gentle chase — high α while following looked like jumps when zoomed out.
          const chasing = Boolean(followId);
          const alpha = row.coast
            ? dist > 100
              ? chasing
                ? 0.48
                : 0.42
              : dist > 40
                ? chasing
                  ? 0.36
                  : 0.32
                : dist > 14
                  ? chasing
                    ? 0.26
                    : 0.22
                  : chasing
                    ? 0.18
                    : 0.14
            : dist > 100
              ? 0.4
              : dist > 40
                ? 0.28
                : dist > 14
                  ? 0.18
                  : 0.12;
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
      }

      if (followId) {
        const row = entries.get(followId);
        if (row) {
          const center = map.getCenter();
          // Follow the painted pin with a small deadzone so the camera doesn't
          // micro-jump every frame (visible when zoomed out).
          const camAim = row.display;
          const camDist = metersBetween(
            { lat: center.lat, lng: center.lng },
            camAim
          );
          const camFloor = row.coast ? 5 : 10;
          if (camDist > camFloor) {
            // Throttle camera to ~20fps. Per-frame setView was forcing Android
            // WebView to recomposite DivIcons and horizontally squash pin labels.
            const camNow = performance.now();
            const lastCam = (group as L.LayerGroup & { __lastFollowCamAt?: number })
              .__lastFollowCamAt;
            if (lastCam == null || camNow - lastCam >= 48) {
              (group as L.LayerGroup & { __lastFollowCamAt?: number }).__lastFollowCamAt =
                camNow;
              const camAlpha = row.coast
                ? camDist > 80
                  ? 0.55
                  : camDist > 25
                    ? 0.38
                    : 0.24
                : camDist > 80
                  ? 0.4
                  : camDist > 25
                    ? 0.22
                    : 0.14;
              const nextLat = center.lat + (camAim.lat - center.lat) * camAlpha;
              const nextLng = center.lng + (camAim.lng - center.lng) * camAlpha;
              // panTo keeps zoom unchanged — setView every frame stretched labels.
              map.panTo([nextLat, nextLng], { animate: false, noMoveStart: true });
            }
            moving = true;
          }
        }
      }

      // Idle when parked. Follow only schedules while camera still needs catch-up.
      if (moving) {
        if (!document.hidden) {
          rafRef.current = requestAnimationFrame(tick);
        }
      }
    };

    const onDragStart = () => setDragging(true);
    const onDragEnd = () => setDragging(false);
    map.on("dragstart", onDragStart);
    map.on("dragend", onDragEnd);
    map.on("zoomstart", onDragStart);
    map.on("zoomend", onDragEnd);

    const onVisibility = () => {
      if (!document.hidden) scheduleTick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    scheduleTick();
    // Expose kick so member updates can restart a paused RAF.
    (group as L.LayerGroup & { __kickSmooth?: () => void }).__kickSmooth = scheduleTick;

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      map.off("dragstart", onDragStart);
      map.off("dragend", onDragEnd);
      map.off("zoomstart", onDragStart);
      map.off("zoomend", onDragEnd);
      container.classList.remove("is-user-dragging");
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
      clustersRef.current.clear();
      groupRef.current = null;
    };
  }, [map]);

  const followEngageRef = useRef<string | null>(null);
  const selectedIdForClusterRef = useRef(selectedMemberId);
  selectedIdForClusterRef.current = selectedMemberId;

  // Shrink / expand home cluster as the map zooms (Life360-style).
  useEffect(() => {
    let raf: number | null = null;
    const applyTier = () => {
      raf = null;
      const tier = clusterZoomTier(map.getZoom());
      const selected = selectedIdForClusterRef.current;
      for (const [, row] of clustersRef.current) {
        if (row.tier === tier) continue;
        row.tier = tier;
        try {
          row.marker.setIcon(clusterBubbleIcon(row.members, selected, tier));
        } catch {
          // Marker may be mid-teardown.
        }
      }
    };
    const onZoom = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(applyTier);
    };
    map.on("zoom", onZoom);
    map.on("zoomend", onZoom);
    applyTier();
    return () => {
      map.off("zoom", onZoom);
      map.off("zoomend", onZoom);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const live = new Set<string>();
    const followId = followSelected ? selectedMemberId : null;
    const { clusters, clusteredIds } = buildMemberClusters(members, followId);
    const tier = clusterZoomTier(map.getZoom());

    // Life360 home bubble — one marker per co-located stationary group.
    const liveClusters = new Set<string>();
    for (const cluster of clusters) {
      liveClusters.add(cluster.key);
      const metaKey = [
        cluster.key,
        selectedMemberId ?? "",
        tier,
        ...cluster.members.map(
          (m) => `${m.id}:${m.avatarUrl ?? ""}:${m.color}:${m.placeCategory ?? ""}:${m.placeName ?? ""}`
        ),
      ].join("|");
      const existing = clustersRef.current.get(cluster.key);
      if (!existing) {
        const marker = L.marker([cluster.lat, cluster.lng], {
          icon: clusterBubbleIcon(cluster.members, selectedMemberId, tier),
          zIndexOffset: 650,
          keyboard: false,
        }).addTo(group);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const oe = e.originalEvent as MouseEvent | TouchEvent | undefined;
          const target = (oe && "target" in oe ? oe.target : null) as HTMLElement | null;
          const face = target?.closest?.("[data-member-id]") as HTMLElement | null;
          const id = face?.getAttribute("data-member-id");
          onSelectRef.current(id ?? cluster.members[0]!.id);
        });
        clustersRef.current.set(cluster.key, {
          marker,
          metaKey,
          lat: cluster.lat,
          lng: cluster.lng,
          members: cluster.members,
          tier,
        });
      } else {
        existing.members = cluster.members;
        if (existing.metaKey !== metaKey) {
          existing.marker.setIcon(
            clusterBubbleIcon(cluster.members, selectedMemberId, tier)
          );
          existing.metaKey = metaKey;
          existing.tier = tier;
        }
        if (
          metersBetween(existing, { lat: cluster.lat, lng: cluster.lng }) > 2
        ) {
          existing.lat = cluster.lat;
          existing.lng = cluster.lng;
          existing.marker.setLatLng([cluster.lat, cluster.lng]);
        }
      }
    }
    for (const [key, row] of clustersRef.current) {
      if (liveClusters.has(key)) continue;
      group.removeLayer(row.marker);
      clustersRef.current.delete(key);
    }

    for (const member of members) {
      if (member.lat == null || member.lng == null) continue;
      // Co-located at home (etc.) — drawn via cluster bubble, not stacked pins.
      if (clusteredIds.has(member.id)) {
        const existingPinned = markersRef.current.get(member.id);
        if (existingPinned) {
          group.removeLayer(existingPinned.marker);
          markersRef.current.delete(member.id);
        }
        continue;
      }
      live.add(member.id);
      const selected = selectedMemberId === member.id;
      // Bucket speed so 54→55→56 doesn't rebuild the icon every tick.
      const speedBucket =
        member.speedKmh != null && member.speedKmh >= 1.5
          ? String(Math.round(member.speedKmh / 5) * 5)
          : "";
      const pinStatus = memberPinStatusLabel(member);
      const metaKey = [
        member.color,
        member.displayName,
        selected ? "1" : "0",
        member.avatarUrl ?? "",
        member.presence,
        speedBucket,
        pinStatus,
      ].join("|");

      const existing = markersRef.current.get(member.id);
      if (!existing) {
        const marker = L.marker([member.lat, member.lng], {
          icon: memberIcon(member, selected),
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
          coast: false,
          metaKey,
        });
        continue;
      }

      const prevTarget = existing.target;
      const prevAt = existing.targetAt;
      const nextTarget = { lat: member.lat, lng: member.lng };
      // Measure hop from last accepted target (not lagging display). Measuring
      // from display made every ~3s highway sample look like a 90m+ teleport.
      const hopM = metersBetween(prevTarget, nextTarget);
      const lagM = metersBetween(existing.display, nextTarget);

      const serverSpeed = member.speedKmh ?? 0;
      const driving =
        (member.presence === "driving" && serverSpeed >= 8) || serverSpeed >= 12;
      // Light coast while walking so follow isn't pause→hop every 8s sample.
      const walkingCoast =
        !driving &&
        ((member.presence === "moving" && serverSpeed >= 1.5) ||
          (serverSpeed >= 3.5 && serverSpeed < 8));
      // Ignore tiny GPS wobble while parked — that was the bounce.
      const noiseFloorM = driving ? 3 : walkingCoast ? 6 : 14;
      // Coast only when the pin is actually moving with real speed — never
      // dead-reckon a frozen "driving @ 95" hover toward a destination.
      // Do NOT gate walking on serverSpeed>=8 (that killed foot coast).
      existing.coast =
        (driving && hopM >= 8 && serverSpeed >= 8) ||
        (walkingCoast && hopM >= 8);
      if (hopM < noiseFloorM || !existing.coast) {
        existing.vx = null;
        existing.vy = null;
        existing.coast = false;
      }
      if (hopM < noiseFloorM && !driving && !walkingCoast) {
        // Keep display steady; still refresh icon/meta if needed below.
      } else if (
        hopM > 900 ||
        (!driving && !walkingCoast && lagM > 280)
      ) {
        // Hard-snap only true teleports / rejoin after a long gap. While
        // following, glide large hops so the pin doesn't jump on zoom-out.
        const followingThis = followIdRef.current === member.id;
        if (followingThis && hopM < 1200) {
          existing.target = nextTarget;
          if (prevAt != null && hopM >= 10) {
            const dt = Math.max(0.6, (performance.now() - prevAt) / 1000);
            existing.vx = (nextTarget.lng - prevTarget.lng) / dt;
            existing.vy = (nextTarget.lat - prevTarget.lat) / dt;
          }
          existing.targetAt = performance.now();
        } else {
          existing.display = { ...nextTarget };
          existing.target = nextTarget;
          if (
            (driving || walkingCoast) &&
            prevAt != null &&
            hopM >= 10 &&
            hopM < 900
          ) {
            const dt = Math.max(0.6, (performance.now() - prevAt) / 1000);
            existing.vx = (nextTarget.lng - prevTarget.lng) / dt;
            existing.vy = (nextTarget.lat - prevTarget.lat) / dt;
          } else {
            existing.vx = null;
            existing.vy = null;
          }
          existing.targetAt = performance.now();
          existing.marker.setLatLng([existing.display.lat, existing.display.lng]);
        }
        const kick = (
          group as L.LayerGroup & { __kickSmooth?: () => void }
        ).__kickSmooth;
        kick?.();
      } else {
        // Smooth glide toward the new fix — never invent velocity from noise.
        if ((driving || walkingCoast) && prevAt != null && hopM >= 8) {
          const dt = Math.max(0.6, (performance.now() - prevAt) / 1000);
          existing.vx = (nextTarget.lng - prevTarget.lng) / dt;
          existing.vy = (nextTarget.lat - prevTarget.lat) / dt;
        } else if (!driving && !walkingCoast) {
          existing.vx = null;
          existing.vy = null;
        }
        existing.target = nextTarget;
        existing.targetAt = performance.now();
        if (hopM >= noiseFloorM || driving || walkingCoast || lagM >= noiseFloorM) {
          const kick = (
            group as L.LayerGroup & { __kickSmooth?: () => void }
          ).__kickSmooth;
          kick?.();
        }
      }

      if (existing.metaKey !== metaKey) {
        existing.marker.setIcon(memberIcon(member, selected));
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
        map.setView([row.display.lat, row.display.lng], zoom, {
          animate: false,
        });
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
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      try {
        map.invalidateSize({ animate: false });
        // animate:false — animated fitBounds desyncs SVG overlays in iOS WKWebView
        // so the blue history line slides off the roads when pinching.
        map.fitBounds(bounds, {
          padding: [36, 36],
          maxZoom: 18,
          animate: false,
        });
      } catch {
        // map may be mid-teardown
      }
    };
    // One layout pass after the history sheet expands the map host.
    requestAnimationFrame(() => {
      run();
      window.setTimeout(run, 180);
    });
    return () => {
      cancelled = true;
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

function memberIcon(member: FamilyMapMemberView, selected: boolean) {
  const {
    color,
    displayName: name,
    avatarUrl,
    presence,
    speedKmh,
  } = member;
  const moving = presence === "driving" || presence === "moving";
  const size = selected ? 52 : moving ? 46 : 40;
  const initial = name.slice(0, 1).toUpperCase();
  const label = name.length > 10 ? `${name.slice(0, 9)}…` : name;
  const status = memberPinStatusLabel(member);
  const face =
    avatarUrl &&
    (avatarUrl.startsWith("data:image/") ||
      avatarUrl.startsWith("https://") ||
      avatarUrl.startsWith("http://"))
      ? `<img class="family-pin-photo" src="${escapeAttr(avatarUrl)}" alt="" width="${size}" height="${size}" />`
      : escapeAttr(initial);

  const showSpeed =
    moving && speedKmh != null && Number.isFinite(speedKmh) && speedKmh >= 1;
  const badgeClass =
    presence === "driving"
      ? "family-pin-badge is-drive"
      : presence === "moving"
        ? "family-pin-badge is-walk"
        : "";
  // Bigger bubbly mode chips — car / feet stay obvious Snapchat-style.
  const carSvg =
    '<svg class="family-pin-badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 11 6.5 6.5a2 2 0 0 1 1.9-1.3h7.2a2 2 0 0 1 1.9 1.3L19 11h1a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1.1a2.5 2.5 0 0 1-4.8 0H8.9a2.5 2.5 0 0 1-4.8 0H3a1 1 0 0 1-1-1v-3a2 2 0 0 1 2-2Zm2.1-3.5L5.9 11h12.2l-1.2-3.5a.5.5 0 0 0-.5-.3H7.6a.5.5 0 0 0-.5.3ZM6.5 16.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm11 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>';
  const feetSvg =
    '<svg class="family-pin-badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 5.5c.8 0 1.5.7 1.5 1.5S14.3 8.5 13.5 8.5 12 7.8 12 7s.7-1.5 1.5-1.5zm-3 0C11.3 5.5 12 6.2 12 7s-.7 1.5-1.5 1.5S9 7.8 9 7s.7-1.5 1.5-1.5zM8.2 9.2c.4-.3.9-.2 1.2.2l.8 1.1h3.6l.8-1.1c.3-.4.8-.5 1.2-.2.4.3.5.8.2 1.2l-1.1 1.6v3.6c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-2.2h-1.6v2.2c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-3.6L8 10.4c-.3-.4-.2-.9.2-1.2zM6.8 16.2c.9 0 1.6.7 1.6 1.6S7.7 19.4 6.8 19.4 5.2 18.7 5.2 17.8s.7-1.6 1.6-1.6zm10.4 0c.9 0 1.6.7 1.6 1.6s-.7 1.6-1.6 1.6-1.6-.7-1.6-1.6.7-1.6 1.6-1.6z"/></svg>';
  const modeIcon = presence === "driving" ? carSvg : feetSvg;
  const badgeInner = showSpeed
    ? `${modeIcon}<span class="family-pin-badge-speed">${Math.round(speedKmh!)}</span>`
    : modeIcon;
  const moveTitle =
    presence === "driving"
      ? "Driving"
      : speedKmh != null && speedKmh >= 8
        ? "On the move"
        : "Walking";
  const badgeHtml = badgeClass
    ? `<div class="${badgeClass}" title="${escapeAttr(moveTitle)}">${badgeInner}${
        showSpeed ? `<span class="family-pin-badge-unit">km/h</span>` : ""
      }</div>`
    : "";

  const statusHtml = status
    ? `<div class="family-pin-status">${escapeAttr(status)}</div>`
    : "";
  const iconW = Math.max(size + 48, status ? 112 : 96);
  const iconH = size + (status ? 42 : 28);
  return L.divIcon({
    className: "family-member-marker",
    html: `<div class="family-pin-wrap${selected ? " is-selected" : ""}${
      moving ? " is-active" : ""
    }${presence === "driving" ? " is-driving" : presence === "moving" ? " is-walking" : ""}">
      <div class="family-pin-avatar-stack">
        ${badgeHtml}
        <div class="family-pin-avatar" style="width:${size}px;height:${size}px;background:${escapeAttr(color)}">${face}</div>
      </div>
      <div class="family-pin-caption">
        <div class="family-pin-label">${escapeAttr(label)}</div>
        ${statusHtml}
      </div>
    </div>`,
    // Stable hit-box; CSS forces content to max-content so labels never stretch
    // into the iconSize box (Android WebView follow-camera bug).
    iconSize: [iconW, iconH],
    iconAnchor: [Math.round(iconW / 2), Math.round(size / 2 + 4)],
  });
}

function placeIcon(name: string, ghost = false) {
  const chipClass = ghost ? "family-place-chip family-place-chip--ghost" : "family-place-chip";
  return L.divIcon({
    className: "family-place-marker",
    html: `<div class="${chipClass}">${name}</div>`,
    iconSize: undefined,
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
  driveImpact = null,
  liveRoutePath = null,
  onOpenOrbMember,
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
  /** Live Route Orbs for active drive impact (weather / traffic / road). */
  driveImpact?: FamilyDriveImpact | null;
  /** Live OSRM path from the followed driver toward their destination. */
  liveRoutePath?: Array<{ lat: number; lng: number }> | null;
  /** From an orb detail card → open that member's Family Intelligence. */
  onOpenOrbMember?: (memberId: string) => void;
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

  const homePlace = useMemo(() => {
    const home = places.find((p) => p.category === "home");
    if (!home) return null;
    return { lat: home.lat, lng: home.lng, radiusM: home.radiusM };
  }, [places]);

  const center = points[0] ?? homePlace ?? { lat: 43.65, lng: -79.38 };
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
        zoom={homePlace ? 15 : 13}
        maxZoom={22}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
        // Continuous pinch levels feel closer to Life360; keep zoomAnimation off
        // so Android WebView doesn't stretch DivIcon pin labels.
        zoomSnap={0}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={80}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        preferCanvas
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
            key="streets-osm"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            // OSM standard shows street names + shops/restaurants/gas at high zoom —
            // denser labels than cleaned-up CARTO Voyager (closer to Life360 usefulness).
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={22}
          />
        )}
        <MapZoomLimits mapStyle={mapStyle} />
        <MapResizeFix resizeKey={resizeKey} />
        <MapClickHandler
          enabled={!routePath?.length && !editingGeofence}
          onMapClick={onMapClick}
        />
        {!routePath?.length && !editingGeofence && !followSelected && !focusGeofenceOnly ? (
          <FitBounds
            fitKey={fitKey}
            points={points}
            bottomPad={bottomPad}
            home={homePlace}
          />
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
              {...(routeCanvasRenderer ? { renderer: routeCanvasRenderer } : {})}
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

        {!focusGeofenceOnly &&
        !editingGeofence &&
        !(routePath && routePath.length >= 2) &&
        (driveImpact || (liveRoutePath && liveRoutePath.length >= 2)) ? (
          <DriveRouteOrbsLayer
            driveImpact={driveImpact}
            members={members}
            focusMemberId={followSelected ? selectedMemberId : null}
            liveRoutePath={liveRoutePath}
            onOpenMember={onOpenOrbMember}
          />
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

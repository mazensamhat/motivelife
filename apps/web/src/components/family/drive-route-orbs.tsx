"use client";

import { useEffect, useMemo, useRef } from "react";
import { Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import type { FamilyDriveEvent, FamilyDriveImpact, FamilyMapMemberView } from "@forward/shared";
import { clusterDriveEvents, DRIVE_EVENT_META } from "@/lib/family-map/drive-impact";
import {
  animatedOrbGlyph,
  resolveVisual,
  toneColor,
  weatherOrbColor,
} from "@/lib/family-map/orb-visuals";
import {
  buildTrafficRouteSegments,
  filterEventsForKinzoEye,
  kinzoClusterRadiusKm,
  kinzoCombinedConditionLabel,
  kinzoExpandedOrbLabel,
  kinzoOrbDisclosure,
  KINZO_ORB,
  type KinzoEyeDensity,
  type KinzoMapLayerFilters,
  DEFAULT_KINZO_LAYER_FILTERS,
} from "@/lib/family-map/kinzo-map-style";

/** Canvas polylines stay glued to tiles in iOS WKWebView. */
const routeCanvasRenderer =
  typeof window !== "undefined" ? L.canvas({ padding: 0.5 }) : undefined;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function orbColorFor(event: FamilyDriveEvent): string {
  const visual = resolveVisual(event);
  if (event.kind === "weather") return weatherOrbColor(visual);
  if (event.kind === "traffic" || event.kind === "air") {
    if (event.severity === "warning") return toneColor("red");
    if (event.severity === "watch") return toneColor("yellow");
    return toneColor("green");
  }
  if (event.kind === "construction") return KINZO_ORB.construction;
  if (event.kind === "hazard") return KINZO_ORB.hazard;
  return DRIVE_EVENT_META[event.kind].color;
}

function distanceBadge(event: FamilyDriveEvent): string | null {
  if (event.distanceAheadKm == null || event.distanceAheadKm <= 0) return null;
  const m = Math.round(event.distanceAheadKm * 1000);
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function singleOrbIcon(event: FamilyDriveEvent): L.DivIcon {
  const color = orbColorFor(event);
  const visual = resolveVisual(event);
  const glyph = animatedOrbGlyph(visual);
  const disclosure = kinzoOrbDisclosure(event);

  if (disclosure === "dot") {
    return L.divIcon({
      className: "family-drive-orb-marker",
      html: `<div class="family-drive-orb family-drive-orb--dot family-drive-orb--tappable" style="--orb:${color}" title="${escapeHtml(event.title)}">
        <div class="family-drive-orb-dot"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  if (disclosure === "card") {
    const label = kinzoExpandedOrbLabel(event);
    return L.divIcon({
      className: "family-drive-orb-marker",
      html: `<div class="family-drive-orb family-drive-orb--card family-drive-orb--tappable" style="--orb:${color}">
        <div class="family-drive-orb-bubble">${glyph}</div>
        <div class="family-drive-orb-card-copy">${escapeHtml(label)}</div>
      </div>`,
      iconSize: [200, 48],
      iconAnchor: [28, 24],
    });
  }

  const dist = distanceBadge(event);
  const badge = dist || event.badge?.trim() || null;
  return L.divIcon({
    className: "family-drive-orb-marker",
    html: `<div class="family-drive-orb family-drive-orb--chip family-drive-orb--tappable" style="--orb:${color}">
      <div class="family-drive-orb-bubble">${glyph}</div>
      ${
        badge
          ? `<div class="family-drive-orb-badge">${escapeHtml(badge)}</div>`
          : ""
      }
    </div>`,
    iconSize: [96, 48],
    iconAnchor: [24, 24],
  });
}

function clusterOrbIcon(events: FamilyDriveEvent[]): L.DivIcon {
  const combined = kinzoCombinedConditionLabel(events);
  const chips = events
    .slice(0, 4)
    .map((e) => {
      const color = orbColorFor(e);
      const visual = resolveVisual(e);
      return `<span class="family-drive-cluster-chip" style="--orb:${color}">${animatedOrbGlyph(visual)}</span>`;
    })
    .join("");
  return L.divIcon({
    className: "family-drive-orb-marker",
    html: `<div class="family-drive-cluster family-drive-orb--tappable family-drive-cluster--kinzo" style="--orb:${KINZO_ORB.intelligence}">
      <div class="family-drive-cluster-orbs">${chips}</div>
      <div class="family-drive-cluster-copy">
        <div class="family-drive-cluster-caption">${escapeHtml(combined.title)}</div>
        <div class="family-drive-cluster-sub">${escapeHtml(combined.subtitle)}</div>
      </div>
    </div>`,
    iconSize: [176, 56],
    iconAnchor: [36, 28],
  });
}

function severityLabel(severity: FamilyDriveEvent["severity"]): string {
  if (severity === "warning") return "Warning";
  if (severity === "watch") return "Watch";
  return "All clear";
}

function orbDetailHtml(events: FamilyDriveEvent[]): string {
  const who = events.find((e) => e.memberName)?.memberName ?? null;
  const memberId = events.find((e) => e.memberId)?.memberId ?? null;
  const combined =
    events.length > 1 ? kinzoCombinedConditionLabel(events) : null;

  const rows = events
    .map((event) => {
      const meta = DRIVE_EVENT_META[event.kind];
      const color = orbColorFor(event);
      const eta =
        event.etaDeltaMin != null && event.etaDeltaMin > 0
          ? `<p class="family-orb-detail-eta">+${event.etaDeltaMin} min vs clear run</p>`
          : "";
      return `<div class="family-orb-detail-row">
        <div class="family-orb-detail-dot" style="background:${color}" aria-hidden="true"></div>
        <div class="min-w-0 flex-1">
          <p class="family-orb-detail-kicker">${escapeHtml(meta.label)}<span>· ${severityLabel(event.severity)}</span></p>
          <p class="family-orb-detail-title">${escapeHtml(kinzoExpandedOrbLabel(event))}</p>
          <p class="family-orb-detail-body">${escapeHtml(event.detail)}</p>
          ${eta}
        </div>
      </div>`;
    })
    .join("");

  const header = who
    ? `<p class="family-orb-detail-header">On ${escapeHtml(who)}&apos;s drive</p>`
    : `<p class="family-orb-detail-header">Along this drive</p>`;
  const combinedLine = combined
    ? `<p class="family-orb-detail-combined">${escapeHtml(combined.title)}${
        combined.totalEta > 0
          ? ` · expected +${Math.round(combined.totalEta)} min`
          : ""
      }</p>`
    : "";
  const link = memberId
    ? `<button type="button" class="family-orb-detail-link" data-orb-member="${escapeHtml(memberId)}">Open insights →</button>`
    : "";

  return `<div class="family-orb-detail">${header}${combinedLine}<div class="family-orb-detail-scroll">${rows}</div>${link}</div>`;
}

/**
 * Imperative Route Orbs — React-Leaflet Markers re-reconcile on every SSE tick.
 * Traffic/tint polylines stay React+canvas (cheap). Tap → popup + Open insights.
 */
function ImperativeOrbsLayer({
  clusters,
  onOpenMember,
}: {
  clusters: ReturnType<typeof clusterDriveEvents>;
  onOpenMember?: (memberId: string) => void;
}) {
  const map = useMap();
  const onOpenRef = useRef(onOpenMember);
  onOpenRef.current = onOpenMember;

  const clustersKey = clusters
    .map((c) =>
      c.type === "single"
        ? `s:${c.event.id}:${c.event.lat.toFixed(4)}:${c.event.lng.toFixed(4)}:${c.event.kind}:${c.event.severity}:${c.event.badge ?? ""}:${kinzoOrbDisclosure(c.event)}`
        : `c:${c.lat.toFixed(4)}:${c.lng.toFixed(4)}:${c.events.map((e) => e.id).join(",")}`
    )
    .join("|");

  useEffect(() => {
    if (clusters.length === 0) return;

    const group = L.layerGroup().addTo(map);
    const cleanups: Array<() => void> = [];

    for (const c of clusters) {
      const events = c.type === "single" ? [c.event] : c.events;
      const lat = c.type === "single" ? c.event.lat : c.lat;
      const lng = c.type === "single" ? c.event.lng : c.lng;
      const icon =
        c.type === "single" ? singleOrbIcon(c.event) : clusterOrbIcon(c.events);

      const marker = L.marker([lat, lng], {
        icon,
        interactive: true,
        zIndexOffset: c.type === "single" ? 550 : 560,
      });

      const popup = L.popup({
        className: "family-orb-popup",
        autoPan: true,
        autoPanPadding: [16, 56],
        closeButton: true,
        maxWidth: 280,
        minWidth: 0,
      }).setContent(orbDetailHtml(events));

      marker.bindPopup(popup);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
      });

      marker.on("popupopen", () => {
        const el = popup.getElement();
        if (!el) return;
        const btn = el.querySelector<HTMLButtonElement>("[data-orb-member]");
        if (!btn) return;
        const onClick = (ev: Event) => {
          ev.stopPropagation();
          const id = btn.getAttribute("data-orb-member");
          if (id) onOpenRef.current?.(id);
        };
        btn.addEventListener("click", onClick);
        cleanups.push(() => btn.removeEventListener("click", onClick));
      });

      marker.addTo(group);
    }

    return () => {
      for (const fn of cleanups) fn();
      map.removeLayer(group);
    };
  }, [map, clustersKey, clusters]);

  return null;
}

/**
 * Active family route (traffic-coloured on the road) + progressive Route Orbs.
 * KINZO Eye density + layer filters control how busy the overlay feels.
 */
export function DriveRouteOrbsLayer({
  driveImpact,
  members,
  focusMemberId = null,
  liveRoutePath = null,
  eyeDensity = "focused",
  layerFilters = DEFAULT_KINZO_LAYER_FILTERS,
  onOpenMember,
}: {
  driveImpact: FamilyDriveImpact | null | undefined;
  members: FamilyMapMemberView[];
  /** When following someone, prefer their orbs. */
  focusMemberId?: string | null;
  /** OSRM (or fallback) path from driver → destination. */
  liveRoutePath?: Array<{ lat: number; lng: number }> | null;
  eyeDensity?: KinzoEyeDensity;
  layerFilters?: KinzoMapLayerFilters;
  /** Optional: open Family Intelligence for that member from the detail card. */
  onOpenMember?: (memberId: string) => void;
}) {
  const events = useMemo(() => {
    if (!driveImpact?.events?.length) return [];
    const scoped = !focusMemberId
      ? driveImpact.events
      : (() => {
          const focused = driveImpact.events.filter(
            (e) => e.memberId === focusMemberId
          );
          return focused.length ? focused : driveImpact.events;
        })();
    return filterEventsForKinzoEye(scoped, eyeDensity, layerFilters);
  }, [driveImpact, focusMemberId, eyeDensity, layerFilters]);

  const clusters = useMemo(
    () => clusterDriveEvents(events, kinzoClusterRadiusKm(eyeDensity)),
    [events, eyeDensity]
  );

  const liveLatLngs = useMemo(
    () => (liveRoutePath ?? []).map((p) => [p.lat, p.lng] as [number, number]),
    [liveRoutePath]
  );

  const tintPaths = useMemo(() => {
    if (liveLatLngs.length >= 2) return [] as Array<[number, number][]>;
    if (!driveImpact || events.length === 0) return [] as Array<[number, number][]>;
    const byMember = new Map<string, FamilyDriveEvent[]>();
    for (const e of events) {
      if (!e.memberId) continue;
      const list = byMember.get(e.memberId) ?? [];
      list.push(e);
      byMember.set(e.memberId, list);
    }
    const paths: Array<[number, number][]> = [];
    for (const [memberId, list] of byMember) {
      const member = members.find((m) => m.id === memberId);
      if (!member?.lat || !member?.lng) continue;
      const sorted = [...list].sort(
        (a, b) => (a.distanceAheadKm ?? 0) - (b.distanceAheadKm ?? 0)
      );
      paths.push([
        [member.lat, member.lng],
        ...sorted.map((e) => [e.lat, e.lng] as [number, number]),
      ]);
    }
    return paths;
  }, [driveImpact, events, members, liveLatLngs.length]);

  const trafficSegments = useMemo(
    () =>
      buildTrafficRouteSegments(
        (liveRoutePath ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
        (driveImpact?.events ?? []).filter((e) =>
          eventPassesLayersForRoad(e.kind, layerFilters)
        )
      ),
    [liveRoutePath, driveImpact, layerFilters]
  );

  if (liveLatLngs.length < 2 && events.length === 0) return null;

  return (
    <>
      {trafficSegments.map((seg, i) => (
        <Polyline
          key={`traf-glow-${i}-${seg.color}`}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: 14,
            opacity: 0.22,
            lineCap: "round",
            lineJoin: "round",
          }}
          {...(routeCanvasRenderer ? { renderer: routeCanvasRenderer } : {})}
        />
      ))}
      {trafficSegments.map((seg, i) => (
        <Polyline
          key={`traf-${i}-${seg.color}`}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: 5.5,
            opacity: 0.96,
            lineCap: "round",
            lineJoin: "round",
          }}
          {...(routeCanvasRenderer ? { renderer: routeCanvasRenderer } : {})}
        />
      ))}
      {tintPaths.map((path, i) =>
        path.length >= 2 ? (
          <Polyline
            key={`tint-${i}`}
            positions={path}
            pathOptions={{
              color: KINZO_ORB.intelligence,
              weight: 10,
              opacity: 0.16,
              lineCap: "round",
              lineJoin: "round",
            }}
            {...(routeCanvasRenderer ? { renderer: routeCanvasRenderer } : {})}
          />
        ) : null
      )}
      <ImperativeOrbsLayer clusters={clusters} onOpenMember={onOpenMember} />
    </>
  );
}

function eventPassesLayersForRoad(
  kind: string | undefined,
  layers: KinzoMapLayerFilters
): boolean {
  if (!kind) return layers.events;
  if (kind === "weather" || kind === "air") return layers.weather;
  if (kind === "traffic") return layers.traffic;
  return layers.events;
}

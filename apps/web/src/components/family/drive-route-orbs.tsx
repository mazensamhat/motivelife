"use client";

import { useMemo } from "react";
import { Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import type { FamilyDriveEvent, FamilyDriveImpact, FamilyMapMemberView } from "@forward/shared";
import { clusterDriveEvents, DRIVE_EVENT_META } from "@/lib/family-map/drive-impact";

/** Canvas polylines stay glued to tiles in iOS WKWebView. */
const routeCanvasRenderer =
  typeof window !== "undefined" ? L.canvas({ padding: 0.5 }) : undefined;

function orbSvg(kind: FamilyDriveEvent["kind"]): string {
  switch (kind) {
    case "weather":
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M7 16a4 4 0 1 1 1.2-7.8A5 5 0 0 1 18 11a3.5 3.5 0 0 1-.2 7"/><path d="M8 19v1M12 18v2M16 19v1"/></svg>`;
    case "traffic":
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="5" height="8" rx="1"/><rect x="10" y="7" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="16" rx="1"/></svg>`;
    case "construction":
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M9 21h6M10 21V10l-3-6h10l-3 6v11"/><path d="M8 10h8"/></svg>`;
    case "hazard":
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 3 22 20H2L12 3z"/><path d="M12 9v5M12 17h.01"/></svg>`;
    case "accident":
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="14" r="3"/><circle cx="16" cy="14" r="3"/><path d="M5 14h2M13 14h2M10 8l2 4 2-4"/></svg>`;
    case "police":
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"/></svg>`;
    case "closure":
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M7 7l10 10"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M12 3l2.2 6.6H21l-5.4 4 2.1 6.5L12 16.8 6.3 20l2.1-6.5L3 9.6h6.8L12 3z"/></svg>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function singleOrbIcon(event: FamilyDriveEvent): L.DivIcon {
  const meta = DRIVE_EVENT_META[event.kind];
  const label = event.detail.length > 28 ? event.title : event.detail;
  return L.divIcon({
    className: "family-drive-orb-marker",
    html: `<div class="family-drive-orb" style="--orb:${meta.color}">
      <div class="family-drive-orb-bubble">${orbSvg(event.kind)}</div>
      <div class="family-drive-orb-label"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(label)}</span></div>
    </div>`,
    iconSize: [148, 56],
    iconAnchor: [28, 28],
  });
}

function clusterOrbIcon(events: FamilyDriveEvent[]): L.DivIcon {
  const chips = events
    .slice(0, 4)
    .map((e) => {
      const meta = DRIVE_EVENT_META[e.kind];
      return `<span class="family-drive-cluster-chip" style="--orb:${meta.color}">${orbSvg(e.kind)}</span>`;
    })
    .join("");
  return L.divIcon({
    className: "family-drive-orb-marker",
    html: `<div class="family-drive-cluster">
      <div class="family-drive-cluster-orbs">${chips}</div>
      <div class="family-drive-cluster-caption">${events.length} on route</div>
    </div>`,
    iconSize: [132, 64],
    iconAnchor: [66, 32],
  });
}

function tintColor(tint: FamilyDriveImpact["routeTint"]): string {
  if (tint === "weather") return "#38bdf8";
  if (tint === "traffic") return "#f87171";
  if (tint === "mixed") return "#a78bfa";
  return "#0ea5e9";
}

/**
 * Live drive route (blue line) + Route Orbs. Route can render alone when the
 * drive is clear; orbs appear when weather/traffic/road signals exist.
 */
export function DriveRouteOrbsLayer({
  driveImpact,
  members,
  focusMemberId = null,
  liveRoutePath = null,
}: {
  driveImpact: FamilyDriveImpact | null | undefined;
  members: FamilyMapMemberView[];
  /** When following someone, prefer their orbs. */
  focusMemberId?: string | null;
  /** OSRM (or fallback) path from driver → destination. */
  liveRoutePath?: Array<{ lat: number; lng: number }> | null;
}) {
  const events = useMemo(() => {
    if (!driveImpact?.events?.length) return [];
    if (!focusMemberId) return driveImpact.events;
    const focused = driveImpact.events.filter((e) => e.memberId === focusMemberId);
    return focused.length ? focused : driveImpact.events;
  }, [driveImpact, focusMemberId]);

  const clusters = useMemo(() => clusterDriveEvents(events), [events]);

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

  if (liveLatLngs.length < 2 && events.length === 0) return null;

  const lineColor = driveImpact ? tintColor(driveImpact.routeTint) : "#0ea5e9";

  return (
    <>
      {liveLatLngs.length >= 2 ? (
        <>
          <Polyline
            positions={liveLatLngs}
            pathOptions={{
              color: lineColor,
              weight: 14,
              opacity: 0.2,
              lineCap: "round",
              lineJoin: "round",
            }}
            {...(routeCanvasRenderer ? { renderer: routeCanvasRenderer } : {})}
          />
          <Polyline
            positions={liveLatLngs}
            pathOptions={{
              color: "#0ea5e9",
              weight: 5,
              opacity: 0.92,
              lineCap: "round",
              lineJoin: "round",
            }}
            {...(routeCanvasRenderer ? { renderer: routeCanvasRenderer } : {})}
          />
        </>
      ) : null}
      {tintPaths.map((path, i) =>
        path.length >= 2 ? (
          <Polyline
            key={`tint-${i}`}
            positions={path}
            pathOptions={{
              color: lineColor,
              weight: 14,
              opacity: 0.22,
              lineCap: "round",
              lineJoin: "round",
            }}
            {...(routeCanvasRenderer ? { renderer: routeCanvasRenderer } : {})}
          />
        ) : null
      )}
      {clusters.map((c) =>
        c.type === "single" ? (
          <Marker
            key={c.event.id}
            position={[c.event.lat, c.event.lng]}
            icon={singleOrbIcon(c.event)}
            interactive={false}
            zIndexOffset={550}
          />
        ) : (
          <Marker
            key={`cluster-${c.events.map((e) => e.id).join("-")}`}
            position={[c.lat, c.lng]}
            icon={clusterOrbIcon(c.events)}
            interactive={false}
            zIndexOffset={560}
          />
        )
      )}
    </>
  );
}

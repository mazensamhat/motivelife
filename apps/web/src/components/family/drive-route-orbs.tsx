"use client";

import { useMemo } from "react";
import { Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import type { FamilyDriveEvent, FamilyDriveImpact, FamilyMapMemberView } from "@forward/shared";
import { clusterDriveEvents, DRIVE_EVENT_META } from "@/lib/family-map/drive-impact";
import {
  animatedOrbGlyph,
  isCompactConditionOrb,
  resolveVisual,
  toneColor,
  weatherOrbColor,
} from "@/lib/family-map/orb-visuals";
import {
  buildTrafficRouteSegments,
  kinzoCombinedConditionLabel,
  KINZO_ORB,
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
  return DRIVE_EVENT_META[event.kind].color;
}

function singleOrbIcon(event: FamilyDriveEvent): L.DivIcon {
  const color = orbColorFor(event);
  const visual = resolveVisual(event);
  const glyph = animatedOrbGlyph(visual);
  const badge = event.badge?.trim() || null;
  const compact = isCompactConditionOrb(event);

  if (compact) {
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
      iconSize: [88, 48],
      iconAnchor: [24, 24],
    });
  }

  const caption = event.title.length > 18 ? event.title.slice(0, 16) + "…" : event.title;
  return L.divIcon({
    className: "family-drive-orb-marker",
    html: `<div class="family-drive-orb family-drive-orb--alert family-drive-orb--tappable" style="--orb:${color}">
      <div class="family-drive-orb-bubble">${glyph}</div>
      <div class="family-drive-orb-caption">${escapeHtml(caption)}</div>
    </div>`,
    iconSize: [120, 48],
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
    iconSize: [168, 56],
    iconAnchor: [36, 28],
  });
}

function severityLabel(severity: FamilyDriveEvent["severity"]): string {
  if (severity === "warning") return "Warning";
  if (severity === "watch") return "Watch";
  return "All clear";
}

function OrbDetailCard({
  events,
  onOpenMember,
}: {
  events: FamilyDriveEvent[];
  onOpenMember?: (memberId: string) => void;
}) {
  const who = events.find((e) => e.memberName)?.memberName ?? null;
  const memberId = events.find((e) => e.memberId)?.memberId ?? null;
  return (
    <div className="family-orb-detail">
      {who ? (
        <p className="family-orb-detail-header">On {who}&apos;s drive</p>
      ) : (
        <p className="family-orb-detail-header">Along this drive</p>
      )}
      <div className="family-orb-detail-scroll">
        {events.map((event) => {
          const meta = DRIVE_EVENT_META[event.kind];
          const color = orbColorFor(event);
          return (
            <div key={event.id} className="family-orb-detail-row">
              <div
                className="family-orb-detail-dot"
                style={{ background: color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="family-orb-detail-kicker">
                  {meta.label}
                  <span>· {severityLabel(event.severity)}</span>
                </p>
                <p className="family-orb-detail-title">
                  {event.badge ? (
                    <>
                      <span className="family-orb-detail-badge">{event.badge}</span>
                      {event.kind === "weather"
                        ? ` · ${event.title}`
                        : event.kind === "air"
                          ? ` AQI · ${event.title}`
                          : event.kind === "traffic"
                            ? ` km/h · ${event.title}`
                            : ` · ${event.title}`}
                    </>
                  ) : (
                    event.title
                  )}
                </p>
                <p className="family-orb-detail-body">{event.detail}</p>
                {event.etaDeltaMin != null && event.etaDeltaMin > 0 ? (
                  <p className="family-orb-detail-eta">
                    +{event.etaDeltaMin} min vs clear run
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {memberId && onOpenMember ? (
        <button
          type="button"
          className="family-orb-detail-link"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMember(memberId);
          }}
        >
          Open insights →
        </button>
      ) : null}
    </div>
  );
}

/**
 * Live drive route (blue line) + Route Orbs. Compact chips on the map;
 * tap an orb for the fuller weather / air / traffic / road detail.
 */
export function DriveRouteOrbsLayer({
  driveImpact,
  members,
  focusMemberId = null,
  liveRoutePath = null,
  onOpenMember,
}: {
  driveImpact: FamilyDriveImpact | null | undefined;
  members: FamilyMapMemberView[];
  /** When following someone, prefer their orbs. */
  focusMemberId?: string | null;
  /** OSRM (or fallback) path from driver → destination. */
  liveRoutePath?: Array<{ lat: number; lng: number }> | null;
  /** Optional: open Family Intelligence for that member from the detail card. */
  onOpenMember?: (memberId: string) => void;
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

  const trafficSegments = useMemo(
    () =>
      buildTrafficRouteSegments(
        (liveRoutePath ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
        events
      ),
    [liveRoutePath, events]
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
            weight: 5,
            opacity: 0.95,
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
      {clusters.map((c) =>
        c.type === "single" ? (
          <Marker
            key={c.event.id}
            position={[c.event.lat, c.event.lng]}
            icon={singleOrbIcon(c.event)}
            interactive
            zIndexOffset={550}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
              },
            }}
          >
            <Popup
              className="family-orb-popup"
              autoPan
              autoPanPadding={[24, 72]}
              closeButton
              maxWidth={320}
              minWidth={240}
            >
              <OrbDetailCard events={[c.event]} onOpenMember={onOpenMember} />
            </Popup>
          </Marker>
        ) : (
          <Marker
            key={`cluster-${c.events.map((e) => e.id).join("-")}`}
            position={[c.lat, c.lng]}
            icon={clusterOrbIcon(c.events)}
            interactive
            zIndexOffset={560}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
              },
            }}
          >
            <Popup
              className="family-orb-popup"
              autoPan
              autoPanPadding={[24, 72]}
              closeButton
              maxWidth={320}
              minWidth={240}
            >
              <OrbDetailCard events={c.events} onOpenMember={onOpenMember} />
            </Popup>
          </Marker>
        )
      )}
    </>
  );
}

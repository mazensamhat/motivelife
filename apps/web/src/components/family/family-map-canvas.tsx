"use client";

import dynamic from "next/dynamic";
import { forwardRef, memo } from "react";
import type { FamilyDriveImpact, FamilyMapMemberView, FamilyPlaceView } from "@forward/shared";
import type { LocalHistoryPathPoint } from "@/lib/family-map/local-history-types";
import type { EditableGeofenceDraft } from "@/components/family/editable-geofence";
import type {
  KinzoEyeDensity,
  KinzoMapLayerFilters,
  KinzoMapTheme,
} from "@/lib/family-map/kinzo-map-style";
import type { HistoryPlaceHighlight } from "@/components/family/family-leaflet-map";

const FamilyLeafletMap = dynamic(() => import("@/components/family/family-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#e8eef5] px-4 text-center text-sm text-forward-500">
      <p>Loading KINZO map…</p>
      <p className="text-xs text-forward-400">If this stays blank, pull to refresh the page.</p>
    </div>
  ),
});

export type FamilyMapCanvasProps = {
  members: FamilyMapMemberView[];
  places: FamilyPlaceView[];
  selectedMemberId: string | null;
  onSelectMember: (id: string) => void;
  followSelected?: boolean;
  overviewRevision?: number;
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
  paused?: boolean;
  routePath?: LocalHistoryPathPoint[] | null;
  visitedPlaces?: HistoryPlaceHighlight[] | null;
  mapStyle?: "streets" | "satellite";
  kinzoTheme?: KinzoMapTheme;
  eyeDensity?: KinzoEyeDensity;
  layerFilters?: KinzoMapLayerFilters;
  showPlaceFences?: boolean;
  placeLabelsMode?: "off" | "ghost" | "on";
  driveImpact?: FamilyDriveImpact | null;
  liveRoutePath?: Array<{ lat: number; lng: number }> | null;
  onOpenOrbMember?: (memberId: string) => void;
};

function membersVisualKey(members: FamilyMapMemberView[]): string {
  return members
    .map(
      (m) =>
        `${m.id}:${m.lat?.toFixed(4) ?? ""}:${m.lng?.toFixed(4) ?? ""}:${m.presence}:${m.statusLabel ?? ""}:${Math.round(m.speedKmh ?? 0)}:${m.headingDeg ?? ""}:${m.likelyDestination ?? ""}:${m.placeName ?? ""}:${m.batteryPercent ?? ""}:${m.avatarUrl ? "1" : "0"}`
    )
    .join("|");
}

function placesVisualKey(places: FamilyPlaceView[]): string {
  return places
    .map(
      (p) =>
        `${p.id}:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}:${p.name}:${p.radiusM}:${p.shape}:${Math.round(p.rotationDeg ?? 0)}`
    )
    .join("|");
}

function pathVisualKey(
  path: Array<{ lat: number; lng: number }> | null | undefined
): string {
  if (!path?.length) return "";
  const first = path[0]!;
  const last = path[path.length - 1]!;
  return `${path.length}:${first.lat.toFixed(4)},${first.lng.toFixed(4)}:${last.lat.toFixed(4)},${last.lng.toFixed(4)}`;
}

function driveImpactKey(impact: FamilyDriveImpact | null | undefined): string {
  if (!impact) return "";
  return [
    impact.primaryMemberId ?? "",
    impact.headline ?? "",
    impact.events
      ?.map(
        (e) =>
          `${e.id}:${e.kind}:${e.severity}:${e.lat.toFixed(3)}:${e.lng.toFixed(3)}:${e.badge ?? ""}`
      )
      .join("|") ?? "",
  ].join(";");
}

function geofenceKey(g: EditableGeofenceDraft | null | undefined): string {
  if (!g) return "";
  return `${g.id}:${g.lat.toFixed(5)}:${g.lng.toFixed(5)}:${g.radiusM}:${g.shape}:${g.rotationDeg}:${g.aspectRatio}`;
}

function layersKey(layers: KinzoMapLayerFilters | undefined): string {
  if (!layers) return "";
  return `${layers.traffic ? 1 : 0}${layers.weather ? 1 : 0}${layers.events ? 1 : 0}`;
}

function draftKey(d: { lat: number; lng: number } | null | undefined): string {
  if (!d) return "";
  return `${d.lat.toFixed(5)},${d.lng.toFixed(5)}`;
}

function visitedKey(places: HistoryPlaceHighlight[] | null | undefined): string {
  if (!places?.length) return "";
  return places.map((v) => `${v.name}:${v.lat}:${v.lng}:${v.radiusM}`).join("|");
}

function canvasPropsEqual(
  prev: FamilyMapCanvasProps,
  next: FamilyMapCanvasProps
): boolean {
  return (
    prev.selectedMemberId === next.selectedMemberId &&
    prev.followSelected === next.followSelected &&
    prev.overviewRevision === next.overviewRevision &&
    prev.selectedPlaceId === next.selectedPlaceId &&
    prev.focusGeofenceOnly === next.focusGeofenceOnly &&
    prev.expanded === next.expanded &&
    prev.layoutKey === next.layoutKey &&
    prev.bottomPad === next.bottomPad &&
    prev.paused === next.paused &&
    prev.mapStyle === next.mapStyle &&
    prev.kinzoTheme === next.kinzoTheme &&
    prev.eyeDensity === next.eyeDensity &&
    prev.showPlaceFences === next.showPlaceFences &&
    prev.placeLabelsMode === next.placeLabelsMode &&
    prev.onSelectMember === next.onSelectMember &&
    prev.onSelectPlace === next.onSelectPlace &&
    prev.onGeofenceChange === next.onGeofenceChange &&
    prev.onMapClick === next.onMapClick &&
    prev.onOpenOrbMember === next.onOpenOrbMember &&
    layersKey(prev.layerFilters) === layersKey(next.layerFilters) &&
    geofenceKey(prev.editingGeofence) === geofenceKey(next.editingGeofence) &&
    draftKey(prev.draftPin) === draftKey(next.draftPin) &&
    membersVisualKey(prev.members) === membersVisualKey(next.members) &&
    placesVisualKey(prev.places) === placesVisualKey(next.places) &&
    pathVisualKey(prev.routePath) === pathVisualKey(next.routePath) &&
    pathVisualKey(prev.liveRoutePath) === pathVisualKey(next.liveRoutePath) &&
    driveImpactKey(prev.driveImpact) === driveImpactKey(next.driveImpact) &&
    visitedKey(prev.visitedPlaces) === visitedKey(next.visitedPlaces)
  );
}

/**
 * Isolated map subtree — memoized so dock/sheet/intel updates don't rebuild Leaflet.
 * Custom equality ignores non-visual SSE field churn (timestamps, etc.).
 */
export const FamilyMapCanvas = memo(
  forwardRef<HTMLDivElement, FamilyMapCanvasProps>(function FamilyMapCanvas(props, ref) {
    return (
      <div className="kinzo-ui relative h-full min-h-0 w-full">
        <div ref={ref} className="absolute inset-0 z-0 bg-[#e8eef5]">
          <div className="h-full w-full">
            <FamilyLeafletMap {...props} />
          </div>
        </div>
      </div>
    );
  }),
  canvasPropsEqual
);

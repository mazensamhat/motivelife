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

/**
 * Isolated map subtree — memoized so dock/sheet/intel updates don't rebuild Leaflet.
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
  })
);

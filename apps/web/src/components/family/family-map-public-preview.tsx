"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import { Expand, Layers, Minimize2 } from "lucide-react";
import { FamilyBriefCard } from "@/components/family/family-brief-card";
import { FamilyMapPeopleSheet } from "@/components/family/family-map-people-sheet";

const FamilyLeafletMap = dynamic(
  () => import("@/components/family/family-leaflet-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#e8eef5] text-sm text-forward-500">
        Loading map…
      </div>
    ),
  }
);

/** Windsor-ish sample pins for the no-login visual preview. */
function sampleMembers(): FamilyMapMemberView[] {
  const now = new Date().toISOString();
  return [
    {
      id: "mazen",
      displayName: "Mazen",
      relationshipLabel: "You",
      role: "OWNER",
      color: "#6f42c1",
      isYou: true,
      isSimulated: true,
      locationSharingLevel: "precise",
      presence: "stationary",
      statusLabel: "At Home",
      lat: 42.2745,
      lng: -83.0005,
      speedKmh: 0,
      headingDeg: null,
      batteryPercent: 81,
      lastLocationAt: now,
      placeName: "Home",
      placeCategory: "home",
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: 120,
      driveScoreRecent: 88,
      phoneNumber: null,
      avatarUrl: null,
      vehicleLabel: null,
    },
    {
      id: "inaam",
      displayName: "Inaam",
      relationshipLabel: "Wife",
      role: "MEMBER",
      color: "#12b886",
      isYou: false,
      isSimulated: true,
      locationSharingLevel: "precise",
      presence: "driving",
      statusLabel: "Driving",
      lat: 42.289,
      lng: -82.98,
      speedKmh: 58,
      headingDeg: 95,
      batteryPercent: 64,
      lastLocationAt: now,
      placeName: null,
      placeCategory: null,
      likelyDestination: "Home",
      destinationConfidence: 0.8,
      etaMinutes: 4,
      timeAtPlaceMinutes: null,
      driveScoreRecent: 91,
      phoneNumber: null,
      avatarUrl: null,
      vehicleLabel: null,
    },
    {
      id: "zeinab",
      displayName: "Zeinab",
      relationshipLabel: "Daughter",
      role: "MEMBER",
      color: "#228be6",
      isYou: false,
      isSimulated: true,
      locationSharingLevel: "precise",
      presence: "stationary",
      statusLabel: "At Remington Park",
      lat: 42.301,
      lng: -82.965,
      speedKmh: 0,
      headingDeg: null,
      batteryPercent: 72,
      lastLocationAt: now,
      placeName: "Remington Park",
      placeCategory: "sports",
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: 55,
      driveScoreRecent: 97,
      phoneNumber: null,
      avatarUrl: null,
      vehicleLabel: null,
    },
    {
      id: "hamoudi",
      displayName: "Hamoudi",
      relationshipLabel: "Son",
      role: "MEMBER",
      color: "#1c7ed6",
      isYou: false,
      isSimulated: true,
      locationSharingLevel: "precise",
      presence: "stationary",
      statusLabel: "At Mic Mac Park",
      lat: 42.268,
      lng: -83.02,
      speedKmh: 0,
      headingDeg: null,
      batteryPercent: 55,
      lastLocationAt: now,
      placeName: "Mic Mac Park",
      placeCategory: "sports",
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: 131,
      driveScoreRecent: 85,
      phoneNumber: null,
      avatarUrl: null,
      vehicleLabel: null,
    },
    {
      id: "mahdi",
      displayName: "Mahdi",
      relationshipLabel: "Son",
      role: "MEMBER",
      color: "#37b24d",
      isYou: false,
      isSimulated: true,
      locationSharingLevel: "precise",
      presence: "stationary",
      statusLabel: "At Home",
      lat: 42.2738,
      lng: -83.0012,
      speedKmh: 0,
      headingDeg: null,
      batteryPercent: 90,
      lastLocationAt: now,
      placeName: "Home",
      placeCategory: "home",
      likelyDestination: null,
      destinationConfidence: null,
      etaMinutes: null,
      timeAtPlaceMinutes: 200,
      driveScoreRecent: null,
      phoneNumber: null,
      avatarUrl: null,
      vehicleLabel: null,
    },
  ];
}

function sampleState(members: FamilyMapMemberView[]): FamilyMapState {
  const now = Date.now();
  return {
    household: {
      id: "preview",
      name: "Samhat Family",
      inviteCode: "",
      isOwner: true,
      memberCount: members.length,
      maxMembers: 6,
    },
    entitlements: {
      liveMap: true,
      intelligence: true,
      canUpgrade: false,
      plan: "family",
      upgradeHeadline: "",
      upgradeBody: "",
    },
    you: {
      memberId: "mazen",
      locationSharingLevel: "precise",
      shareDrivingData: true,
      sharePlaceHistory: true,
      shareRoutineLearning: true,
      shareFamilyInsights: true,
      shareDigitalTwinIntegration: true,
      memberKind: "ADULT",
      vehicle: null,
      fuelSummary: {
        monthCad: 24.6,
        prevMonthCad: 31.2,
        tripCount: 12,
        direction: "down",
      },
    },
    members,
    places: [
      {
        id: "home",
        name: "Home",
        lat: 42.2745,
        lng: -83.0005,
        radiusM: 120,
        category: "home",
        shape: "circle",
        visitCount: 40,
        averageVisitMinutes: 480,
        lastVisitedAt: new Date(now - 10 * 60_000).toISOString(),
        membersHeadingThere: 0,
        insight: null,
        mostCommonVisitorName: null,
        notifyOnEnter: true,
        notifyOnLeave: true,
      },
    ],
    recentTrips: [
      {
        id: "t1",
        memberId: "zeinab",
        memberName: "Zeinab",
        fromLabel: "Home",
        toLabel: "Remington Park",
        distanceKm: 6.2,
        durationMinutes: 14,
        avgSpeedKmh: 38,
        maxSpeedKmh: 62,
        driveScore: 97,
        band: "safe",
        hardBraking: 1,
        rapidAcceleration: 0,
        unusualRouteEvents: 0,
        estimatedFuelCostCad: 1.1,
        startedAt: new Date(now - 3_600_000).toISOString(),
        endedAt: new Date(now - 2_700_000).toISOString(),
      },
    ],
    placeVisitsToday: [
      {
        id: "v1",
        memberId: "zeinab",
        placeName: "Remington Park",
        isActive: true,
        arrivedAt: new Date(now - 55 * 60_000).toISOString(),
        departedAt: null,
        dwellMinutes: 55,
      },
    ],
    flow: {
      everyoneHomeByLabel: "Everyone is usually home by 8:00 PM",
      conflictNote: null,
      opportunityNote: null,
      members: members.map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        statusLabel: m.statusLabel,
        presence: m.presence,
        placeName: m.placeName,
        etaMinutes: m.etaMinutes,
        batteryPercent: m.batteryPercent,
        likelyDestination: m.likelyDestination,
        destinationConfidence: m.destinationConfidence,
      })),
    },
    somethingDifferent: {
      memberName: "Zeinab",
      title: "Longer than usual",
      body: "Zeinab has been at Remington Park longer than usual.",
      tone: "watch",
    },
    smartDeparture: {
      leaveByLabel: "3:40 PM",
      arriveByLabel: "3:58 PM",
      destinationName: "Hamoudi Work",
      etaMinutes: 18,
      trafficBufferMin: 5,
      rationale: "Calendar + traffic buffer",
    },
    familyTime: {
      commuteMinPerDay: 42,
      commuteDeltaMinPerDay: -6,
      familyHomeHoursWeek: 38,
      insight: "About 5h 12m together at Home so far today.",
    },
    areaIntel: {
      center: { lat: 42.28, lng: -83.0 },
      weather: {
        summary: "Partly cloudy",
        tempC: 22,
        feelsLikeC: 21,
        windKmh: 12,
        precipMm: 0,
        code: 2,
        severe: false,
      },
      traffic: { level: "clear", summary: "Roads look clear" },
      alerts: [],
      updatedAt: new Date(now).toISOString(),
    },
    updatedAt: new Date(now).toISOString(),
  };
}

/**
 * Public no-login preview of the redesigned Family Map.
 * Uses sample pins — no database / session required.
 */
export function FamilyMapPublicPreview() {
  const members = useMemo(() => sampleMembers(), []);
  const state = useMemo(() => sampleState(members), [members]);
  const [selectedId, setSelectedId] = useState("zeinab");
  const [followSelected, setFollowSelected] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");

  function selectMember(id: string) {
    setSelectedId(id);
    setFollowSelected(true);
  }

  return (
    <div className="min-h-dvh bg-[#edf1f6]">
      <div className="bg-amber-50 px-3 py-2 text-center text-[11px] font-medium text-amber-950">
        Public preview · sample family data · no sign-in · not production
      </div>

      <div className="mx-auto max-w-lg px-0 pb-8 pt-3 sm:max-w-2xl sm:px-3">
        <div className="mb-2 flex items-baseline justify-between px-3 sm:px-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-forward-900">
            Family Map
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-blue">
            Preview
          </p>
        </div>

        <div
          className={
            expanded
              ? "fixed inset-0 z-[80] bg-white"
              : "relative z-0 mx-2 h-[min(72dvh,680px)] min-h-[300px] overflow-hidden rounded-[1.5rem] border border-forward-200/80 bg-[#e8eef5] sm:mx-0 sm:h-[min(74vh,760px)]"
          }
        >
          <div className="h-full w-full overflow-hidden rounded-[1.5rem]">
            <FamilyLeafletMap
              members={members}
              places={state.places}
              selectedMemberId={selectedId}
              onSelectMember={selectMember}
              followSelected={followSelected}
              selectedPlaceId={null}
              onSelectPlace={() => undefined}
              editingGeofence={null}
              onGeofenceChange={() => undefined}
              focusGeofenceOnly={false}
              onMapClick={() => undefined}
              draftPin={null}
              expanded={expanded}
              layoutKey={`preview:${selectedId}:${followSelected ? 1 : 0}`}
              bottomPad={followSelected ? 200 : 96}
              routePath={null}
              visitedPlaces={[]}
              mapStyle={mapStyle}
              showPlaceFences
              placeLabelsMode="ghost"
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-2 sm:p-3">
            <div className="pointer-events-auto flex items-center justify-between gap-2">
              <div className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-md">
                All family
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md"
                  aria-label={expanded ? "Exit full map" : "Expand map"}
                >
                  {expanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Expand className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMapStyle((s) => (s === "streets" ? "satellite" : "streets"))
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md"
                  aria-label="Toggle map style"
                >
                  <Layers className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <FamilyMapPeopleSheet
            members={members}
            selectedId={selectedId}
            state={state}
            intelligenceUnlocked
            detailOpen={followSelected}
            onSelectMember={selectMember}
            onOpenDetails={selectMember}
            onCloseDetail={() => setFollowSelected(false)}
          />
        </div>

        {!expanded ? (
          <div className="mt-3 space-y-3 px-2 sm:px-0">
            <FamilyBriefCard state={state} onOpenMember={selectMember} />
            <p className="text-center text-xs text-forward-500">
              This is the real redesigned UI with sample pins. Production stays
              unchanged until you approve.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type {
  DrivingReport,
  FamilyMapMemberView,
  FamilyMapState,
} from "@forward/shared";
import { Expand, Layers, Minimize2, Settings2, X } from "lucide-react";
import { FamilyBriefCard } from "@/components/family/family-brief-card";
import { FamilyInboxPanel } from "@/components/family/family-inbox-panel";
import { FamilyMembersPanel } from "@/components/family/family-members-panel";
import {
  FamilyMapPeopleStrip,
  FamilyMapPersonDetail,
} from "@/components/family/family-map-people-sheet";
import { TemporaryCircleCard } from "@/components/family/temporary-circle-card";
import { WeeklyDrivingReport } from "@/components/family/weekly-driving-report";
import { sampleDriveImpactForPreview } from "@/lib/family-map/drive-impact";

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
      speedKmh: 42,
      headingDeg: 220,
      batteryPercent: 64,
      lastLocationAt: now,
      placeName: null,
      placeCategory: null,
      likelyDestination: "Home",
      destinationConfidence: 0.8,
      etaMinutes: 12,
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
      presence: "moving",
      statusLabel: "Walking",
      lat: 42.301,
      lng: -82.965,
      speedKmh: 5,
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
      alertArrive: true,
      alertLeave: true,
      alertDriving: true,
      alertRoadHazards: true,
      alertStillThere: true,
      alertNoShow: true,
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
        summary: "Heavy rain",
        tempC: 12,
        feelsLikeC: 10,
        windKmh: 28,
        precipMm: 4.2,
        code: 65,
        severe: false,
      },
      traffic: {
        level: "slow",
        summary: "Slower movement on the road (Inaam ~42 km/h).",
      },
      alerts: [],
      driveImpact: sampleDriveImpactForPreview({
        memberId: "inaam",
        memberName: "Inaam",
        lat: 42.289,
        lng: -82.98,
        headingDeg: 220,
        etaMinutes: 12,
      }),
      updatedAt: new Date(now).toISOString(),
    },
    updatedAt: new Date(now).toISOString(),
  };
}

/**
 * Public no-login preview of the redesigned Family Map.
 * Uses sample pins + demo panels — no database / session required.
 */
export function FamilyMapPublicPreview() {
  const [members, setMembers] = useState(() => sampleMembers());
  const state = useMemo(() => sampleState(members), [members]);
  const demoReport = useMemo(() => sampleDrivingReport(members), [members]);
  const [selectedId, setSelectedId] = useState("inaam");
  const [followSelected, setFollowSelected] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [circleTab, setCircleTab] = useState<"family" | "friends">("family");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsNote, setSettingsNote] = useState<string | null>(null);

  function selectMember(id: string) {
    setSelectedId(id);
    setFollowSelected(true);
    setCircleTab("family");
  }

  function previewPatch(memberId: string, body: Record<string, unknown>) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          ...(typeof body.color === "string" ? { color: body.color } : null),
          ...(body.relationshipLabel !== undefined
            ? {
                relationshipLabel:
                  body.relationshipLabel == null || body.relationshipLabel === ""
                    ? null
                    : String(body.relationshipLabel),
              }
            : null),
          ...(typeof body.displayName === "string"
            ? { displayName: body.displayName }
            : null),
        };
      })
    );
    setSettingsNote("Preview only — colors/relationships update locally.");
  }

  return (
    <div className="min-h-dvh bg-[#edf1f6]">
      <div className="bg-amber-50 px-3 py-2 text-center text-[11px] font-medium text-amber-950">
        Public preview · full sample UI · no sign-in · not production
      </div>

      <div className="mx-auto max-w-lg px-0 pb-10 pt-3 sm:max-w-2xl sm:px-3">
        <div className="mb-2 flex items-baseline justify-between px-3 sm:px-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-forward-900">
            Family Map
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-blue">
            Preview
          </p>
        </div>

        <div className={expanded ? "contents" : "space-y-2"}>
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
                bottomPad={110}
                routePath={null}
                visitedPlaces={[]}
                mapStyle={mapStyle}
                showPlaceFences
                placeLabelsMode="ghost"
                driveImpact={state.areaIntel.driveImpact ?? null}
                liveRoutePath={[
                  { lat: 42.289, lng: -82.98 },
                  { lat: 42.285, lng: -82.99 },
                  { lat: 42.28, lng: -82.995 },
                  { lat: 42.2745, lng: -83.0005 },
                ]}
              />
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-2 sm:p-3">
              <div className="pointer-events-auto flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex rounded-full bg-white/95 p-1 shadow-md">
                    {(
                      [
                        ["family", "Family"],
                        ["friends", "Friends"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCircleTab(id)}
                        className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                          circleTab === id
                            ? "bg-forward-900 text-white"
                            : "text-forward-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md"
                    aria-label="Family settings"
                    title="Family settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMapStyle((s) =>
                        s === "streets" ? "satellite" : "streets"
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md"
                    aria-label="Toggle map style"
                  >
                    <Layers className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {circleTab === "family" ? (
              <FamilyMapPeopleStrip
                members={members}
                selectedId={selectedId}
                detailOpen={followSelected}
                onSelectMember={selectMember}
              />
            ) : (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
                <div className="pointer-events-auto rounded-[1.35rem] bg-white/95 px-4 py-3 text-sm text-forward-700 shadow-md ring-1 ring-forward-100">
                  Friends circle — join/create stays on the live app.
                </div>
              </div>
            )}
          </div>

          {!expanded && followSelected && circleTab === "family" ? (
            <FamilyMapPersonDetail
              members={members}
              selectedId={selectedId}
              state={state}
              intelligenceUnlocked
              onOpenDetails={selectMember}
              onCloseDetail={() => setFollowSelected(false)}
              className="mx-2 sm:mx-0"
            />
          ) : null}
        </div>

        {!expanded && circleTab === "family" ? (
          <div className="mt-3 space-y-3 px-2 sm:px-0">
            <FamilyBriefCard state={state} onOpenMember={selectMember} />
            <WeeklyDrivingReport
              demoReport={demoReport}
              onSelectMember={selectMember}
            />
            <FamilyInboxPanel
              entitlements={state.entitlements}
              demoAlerts={SAMPLE_ALERTS}
            />
            <TemporaryCircleCard entitlements={state.entitlements} />
            <p className="text-center text-xs text-forward-500">
              Full redesigned stack with sample data. Production stays unchanged
              until you approve.
            </p>
          </div>
        ) : null}
      </div>

      {showSettings ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close settings"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative z-[1] flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-[1.75rem] bg-[#edf1f6] shadow-2xl sm:rounded-[1.75rem]">
            <div className="flex items-center justify-between gap-2 border-b border-forward-100 bg-white px-4 py-3 sm:rounded-t-[1.75rem]">
              <div>
                <p className="font-display text-base font-semibold text-forward-900">
                  Family settings
                </p>
                <p className="text-[11px] text-forward-500">
                  Members + map colors (preview)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-forward-100 text-forward-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {settingsNote ? (
                <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
                  {settingsNote}
                </p>
              ) : null}
              <FamilyMembersPanel
                members={members}
                isOwner
                inviteCode="PREVIEW"
                busy={false}
                onUpdated={() => undefined}
                onError={(msg) => setSettingsNote(msg)}
                onShareInvite={() =>
                  setSettingsNote("Invite sharing stays on the live app.")
                }
                previewPatch={previewPatch}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const SAMPLE_ALERTS = [
  {
    id: "a1",
    type: "family_geofence",
    title: "Zeinab arrived at Remington Park",
    body: "Arrived 55 min ago — longer than usual for this stop.",
    href: null,
    readAt: null,
    createdAt: new Date(Date.now() - 55 * 60_000).toISOString(),
  },
  {
    id: "a2",
    type: "family_driving",
    title: "Inaam is driving home",
    body: "ETA about 4 min · 58 km/h on Tecumseh.",
    href: null,
    readAt: null,
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
];

function sampleDrivingReport(members: FamilyMapMemberView[]): DrivingReport {
  const now = Date.now();
  return {
    period: "this_week",
    label: "This week",
    rangeStart: new Date(now - 6 * 86_400_000).toISOString(),
    rangeEnd: new Date(now).toISOString(),
    totals: {
      drives: 18,
      distanceKm: 142,
      hardBraking: 3,
      rapidAcceleration: 2,
      unusualRouteEvents: 1,
      riskyEvents: 6,
      topSpeedKmh: 98,
      topSpeedMemberName: "Inaam",
      avgDriveScore: 88,
    },
    vsPrevious: {
      hardBraking: -1,
      rapidAcceleration: 0,
      unusualRouteEvents: 1,
      riskyEvents: 0,
      distanceKm: 12,
      drives: 2,
    },
    insight:
      "Most drives look calm. One unusual stop on Hamoudi’s commute and Zeinab’s park stay ran long.",
    members: members
      .filter((m) => m.driveScoreRecent != null)
      .map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        color: m.color,
        driveCount: m.id === "inaam" ? 7 : m.id === "zeinab" ? 5 : 3,
        distanceKm: m.id === "inaam" ? 64 : m.id === "zeinab" ? 28 : 18,
        hardBraking: m.id === "hamoudi" ? 2 : 0,
        rapidAcceleration: m.id === "inaam" ? 1 : 0,
        unusualRouteEvents: m.id === "hamoudi" ? 1 : 0,
        riskyEvents: m.id === "hamoudi" ? 3 : m.id === "inaam" ? 1 : 0,
        topSpeedKmh: m.id === "inaam" ? 98 : 72,
        avgDriveScore: m.driveScoreRecent,
      })),
  };
}

"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  type DriveTripSummary,
  type FamilyAreaIntel,
  type FamilyHistoryItem,
  type FamilyMapMemberView,
  type FamilyMapState,
  type LocationSharingLevel,
} from "@forward/shared";
import { Expand, Layers, Minimize2, Settings2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/button";
import {
  LocationHistoryPanel,
  type DriveHistoryPager,
} from "@/components/family/location-history-panel";
import { HistoryDrivePagerBar } from "@/components/family/history-drive-pager-bar";
import { MemberIntelSheet } from "@/components/family/member-intel-sheet";
import { SavePinSheet, CATEGORY_EMOJI } from "@/components/family/save-pin-sheet";
import { PlaceSettingsSheet, type PlaceSheetMode } from "@/components/family/place-settings-sheet";
import type { EditableGeofenceDraft } from "@/components/family/editable-geofence";
import { FamilyBriefCard } from "@/components/family/family-brief-card";
import { FamilyMapPeopleStrip, FamilyMapPersonDetail } from "@/components/family/family-map-people-sheet";
import { WeeklyDrivingReport } from "@/components/family/weekly-driving-report";
import { FamilyInboxPanel } from "@/components/family/family-inbox-panel";
import { TemporaryCircleCard } from "@/components/family/temporary-circle-card";
import { FamilyIntelLockedPreview } from "@/components/family/family-intel-locked-preview";
import { FamilyMembersPanel } from "@/components/family/family-members-panel";
import { useFamilyLocationShare } from "@/hooks/use-family-location-share";
import { useFamilyMapSse } from "@/hooks/use-family-map-sse";
import { resizeImageFile } from "@/lib/avatar";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";
import { fetchRouteForDriveTrip } from "@/lib/family-map/fetch-trip-route";
import {
  FAMILY_FIXED_HOME_HINT,
  isFixedHomeMember,
} from "@/lib/family-map/fixed-home-members";
import {
  canUseNativeLocationBridge,
  describeNativeLocationPermission,
  getNativeLocationPermission,
  requestNativeLocationFix,
  requestNativePrivacyPermissions,
  setNativeLocationPaused,
} from "@/lib/family-map/native-location-bridge";
import {
  hasLocationPermission,
  readShareLivePreference,
  requestLocationAccess,
  stopBackgroundLocationSharing,
  tryOpenAppSettings,
  tryOpenLocationSettings,
  writeShareLivePreference,
} from "@/lib/family-map/request-location";
import {
  familyInviteShareText,
  familyInviteUrl,
} from "@/lib/family-map/invite-link";
import { postFamilyLocationFix } from "@/lib/family-map/post-location-fix";
import {
  readPlaceFencesPreference,
  readPlaceLabelsMode,
  writePlaceFencesPreference,
  writePlaceLabelsMode,
  type PlaceLabelsMode,
} from "@/lib/family-map/place-map-prefs";
import { getNativeShellPlatform, isNativeShell } from "@/lib/native-shell";

const FamilyLeafletMap = dynamic(() => import("@/components/family/family-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#e8eef5] px-4 text-center text-sm text-forward-500">
      <p>Loading map tiles…</p>
      <p className="text-xs text-forward-400">If this stays blank, pull to refresh the page.</p>
    </div>
  ),
});

type CircleTab = "family" | "friends";

async function readError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export function FamilyMapPanel() {
  const [state, setState] = useState<FamilyMapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Opt-in — never auto-prompt GPS on open; restore prior choice after grant
  const [shareLive, setShareLive] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [locationDiag, setLocationDiag] = useState<string | null>(null);
  const [osLocationGranted, setOsLocationGranted] = useState(false);
  const [enablingLocation, setEnablingLocation] = useState(false);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleBusy, setVehicleBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  /** Visual only — rings / labels; places stay saved either way. */
  const [showPlaceFences, setShowPlaceFences] = useState(false);
  const [placeLabelsMode, setPlaceLabelsMode] = useState<PlaceLabelsMode>("ghost");
  const [showTools, setShowTools] = useState(false);
  /** QA: `?familyLock=1` forces locked Family Intelligence even for comp/Family accounts. */
  const [forceFamilyLock, setForceFamilyLock] = useState(false);
  const [circleTab, setCircleTab] = useState<CircleTab>("family");
  const [joinCode, setJoinCode] = useState("");
  const [inviteShareHint, setInviteShareHint] = useState<string | null>(null);
  const [householdNameDraft, setHouseholdNameDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mapAnchorRef = useRef<HTMLDivElement>(null);
  const [friends, setFriends] = useState<FriendsCircleState | null>(null);
  const [placeDraft, setPlaceDraft] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [followSelected, setFollowSelected] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [placeEdit, setPlaceEdit] = useState<EditableGeofenceDraft | null>(null);
  const [placeSheetMode, setPlaceSheetMode] = useState<PlaceSheetMode>("menu");
  const [portalReady, setPortalReady] = useState(false);
  const [historyTrip, setHistoryTrip] = useState<LocalHistoryTrip | null>(null);
  const [drivePager, setDrivePager] = useState<DriveHistoryPager | null>(null);
  /** Parent-owned drive list so map pager works even if the sheet/panel remounts. */
  const [historyDrives, setHistoryDrives] = useState<DriveTripSummary[]>([]);
  const [historyStepBusy, setHistoryStepBusy] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [visitedPlaces, setVisitedPlaces] = useState<
    { name: string; lat: number; lng: number; radiusM: number }[]
  >([]);
  /** Guards async history/road-snap so Hamoudi's late fetch can't paint over daughter. */
  const historyOwnerRef = useRef<string | null>(null);
  const historySelectGenRef = useRef(0);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Switching people always drops the previous route overlay + highlights.
  useEffect(() => {
    selectedIdRef.current = selectedId;
    historyOwnerRef.current = null;
    historySelectGenRef.current += 1;
    setHistoryTrip(null);
    setVisitedPlaces([]);
  }, [selectedId]);

  const refreshLocationDiag = useCallback(() => {
    if (!isNativeShell()) {
      setLocationDiag(null);
      return;
    }
    void (async () => {
      // Inject flags can lag a tick behind first paint after redirects.
      for (let i = 0; i < 5; i++) {
        if (canUseNativeLocationBridge()) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const [line, granted] = await Promise.all([
        describeNativeLocationPermission(),
        hasLocationPermission(),
      ]);
      setLocationDiag(line || null);
      setOsLocationGranted(granted);
    })();
  }, []);

  useEffect(() => {
    refreshLocationDiag();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshLocationDiag();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshLocationDiag]);

  const applyMapState = useCallback((data: FamilyMapState) => {
    if (!data?.household || !Array.isArray(data.members)) return;
    setState((prev) => {
      let next = data;
      // Sticky Family Intelligence unlock: billing timeouts on SSE/poll were
      // flipping intelligence→false and remounting the "Ask the household
      // owner" lock over live drive insights.
      if (
        prev?.entitlements?.intelligence === true &&
        next.entitlements &&
        next.entitlements.intelligence !== true
      ) {
        next = { ...next, entitlements: prev.entitlements };
      }
      // Don't let a slow poll wipe a fresher self "Updated Now" from GPS/posts.
      if (!prev) return next;
      const youIdx = next.members.findIndex((m) => m.isYou);
      const prevYou = prev.members.find((m) => m.isYou);
      if (youIdx < 0 || !prevYou?.lastLocationAt) return next;
      const serverYou = next.members[youIdx]!;
      const prevMs = Date.parse(prevYou.lastLocationAt);
      const serverMs = serverYou.lastLocationAt
        ? Date.parse(serverYou.lastLocationAt)
        : 0;
      if (
        Number.isFinite(prevMs) &&
        prevMs > serverMs + 2_000 &&
        Date.now() - prevMs < 120_000
      ) {
        const members = next.members.slice();
        members[youIdx] = { ...serverYou, lastLocationAt: prevYou.lastLocationAt };
        return { ...next, members };
      }
      return next;
    });
    setHouseholdNameDraft(data.household.name);
    const you = data.members.find((m) => m.isYou);
    if (you) setDisplayNameDraft(you.displayName);
    if (data.you?.vehicle) {
      setVehicleMake(data.you.vehicle.make);
      setVehicleModel(data.you.vehicle.model);
      setVehicleYear(data.you.vehicle.year != null ? String(data.you.vehicle.year) : "");
    }
    setError(null);
    setSelectedId((prev) => prev ?? data.members[0]?.id ?? null);
  }, []);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch("/api/family/map", { signal });
      if (!res.ok) {
        setError(await readError(res));
        return null;
      }
      const data = (await res.json()) as FamilyMapState;
      if (!data?.household || !Array.isArray(data.members)) {
        setError("Family Map returned an incomplete response. Tap Try again.");
        return null;
      }
      applyMapState(data);
      return data;
    },
    [applyMapState]
  );

  // Push live pins over SSE; HTTP poll becomes a slow safety net when live.
  const { live: mapSseLive } = useFamilyMapSse({
    enabled: !loading,
    onMap: applyMapState,
  });

  const refreshFriends = useCallback(async () => {
    try {
      const res = await fetch("/api/circles");
      if (!res.ok) return;
      const data = (await res.json()) as FriendsCircleState;
      setFriends(data);
    } catch {
      // Friends is secondary — never block the Family Map
    }
  }, []);

  const loadAreaIntel = useCallback(
    (center: { lat: number; lng: number } | null | undefined, cancelled?: () => boolean) => {
      if (!center) return;
      void fetch(`/api/family/area-intel?lat=${center.lat}&lng=${center.lng}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { areaIntel?: FamilyAreaIntel } | null) => {
          if (!body?.areaIntel || cancelled?.()) return;
          setState((prev) => (prev ? { ...prev, areaIntel: body.areaIntel! } : prev));
        })
        .catch(() => undefined);
    },
    []
  );

  // Boot once — do not re-run on tab changes (that was re-triggering the spinner)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const failSafe = window.setTimeout(() => controller.abort(), 20_000);

    (async () => {
      setLoading(true);
      try {
        const data = await refresh(controller.signal);
        if (cancelled) return;
        void refreshFriends();
        loadAreaIntel(data?.areaIntel?.center, () => cancelled);

        const you = data?.members.find((m) => m.isYou);
        // Pre-launch: Mahdi (and any fixed-home name) — no location prompts, pin at Home.
        if (you && isFixedHomeMember(you.displayName)) {
          setShareLive(false);
          writeShareLivePreference(false);
          stopBackgroundLocationSharing();
          setNativeLocationPaused(true);
          setLocationHint(FAMILY_FIXED_HOME_HINT);
        } else {
          setNativeLocationPaused(false);
          // Resume live sharing without re-prompting. Preference OR OS grant is enough.
          const prefOn = readShareLivePreference();
          const granted = await hasLocationPermission();
          let alwaysOn = false;
          if (canUseNativeLocationBridge()) {
            const snap = await getNativeLocationPermission();
            alwaysOn = Boolean(snap.ok && snap.backgroundGranted);
          }
          if (!cancelled && (prefOn || granted || alwaysOn)) {
            // If they shared before, keep sharing even if the permission probe flakes.
            setShareLive(true);
            writeShareLivePreference(true);
            if (granted || alwaysOn) {
              setLocationHint(
                alwaysOn
                  ? "Always location on — sharing with your family."
                  : "Location on — sharing with your family."
              );
              void pushImmediateLocationFix({ silent: true });
            } else {
              setLocationHint(
                "Resuming live location… If your pin doesn’t appear, tap Allow location once."
              );
              void pushImmediateLocationFix({ silent: true });
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          const aborted = e instanceof DOMException && e.name === "AbortError";
          setError(
            aborted
              ? "Map is taking too long on this connection. Tap Try again."
              : e instanceof Error && e.message
                ? e.message
                : "Could not load Family Map."
          );
        }
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, [refresh, refreshFriends, loadAreaIntel]);

  useEffect(() => {
    // SSE carries live pins; poll is a fallback (or sparse backup while SSE is up).
    const someoneDriving = Boolean(
      state?.members.some(
        (m) =>
          m.presence === "driving" ||
          m.presence === "moving" ||
          (m.speedKmh != null && m.speedKmh >= 8)
      )
    );
    const refreshMs = mapSseLive
      ? someoneDriving || followSelected
        ? 12_000
        : 20_000
      : followSelected
        ? someoneDriving
          ? 500
          : 700
        : someoneDriving
          ? 1_000
          : 3_000;
    const id = window.setInterval(() => {
      const controller = new AbortController();
      const failSafe = window.setTimeout(() => controller.abort(), 20_000);
      void refresh(controller.signal)
        .then((data) => {
          if (data?.areaIntel?.center) loadAreaIntel(data.areaIntel.center);
        })
        .finally(() => window.clearTimeout(failSafe));
      if (circleTab === "friends") void refreshFriends();
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [
    refresh,
    refreshFriends,
    circleTab,
    loadAreaIntel,
    followSelected,
    state?.members,
    mapSseLive,
  ]);

  useEffect(() => {
    if (!expanded && !showTools) return;
    const scroller = document.querySelector<HTMLElement>("[data-dashboard-scroll]");
    const prevBody = document.body.style.overflow;
    const prevMain = scroller?.style.overflow ?? "";
    document.body.style.overflow = "hidden";
    if (scroller) scroller.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      if (scroller) scroller.style.overflow = prevMain;
    };
  }, [expanded, showTools]);

  useEffect(() => {
    try {
      setForceFamilyLock(
        new URLSearchParams(window.location.search).get("familyLock") === "1"
      );
    } catch {
      setForceFamilyLock(false);
    }
  }, []);

  useEffect(() => {
    setPlaceLabelsMode(readPlaceLabelsMode());
    setShowPlaceFences(readPlaceFencesPreference());
  }, []);

  const youMember = state?.members.find((m) => m.isYou) ?? null;
  const fixedHomeForYou = isFixedHomeMember(youMember?.displayName);
  /** Paid Family Intelligence — false for free/trial map users (and `?familyLock=1`). */
  const intelligenceUnlocked =
    Boolean(state?.entitlements?.intelligence) && !forceFamilyLock;
  const { sharing, error: shareError, lastFixAt, clearError } = useFamilyLocationShare({
    // Share Live alone — do not gate on `state` (brief nulls used to tear down
    // the web watcher; native Always must stay up across map navigations).
    enabled: shareLive && !fixedHomeForYou,
    intervalMs: followSelected ? 800 : 3_000,
    onState: applyMapState,
    onLiveness: (atIso) => {
      setState((prev) => {
        if (!prev) return prev;
        const idx = prev.members.findIndex((m) => m.isYou);
        if (idx < 0) return prev;
        const you = prev.members[idx]!;
        // Don't regress a fresher server stamp.
        const prevMs = you.lastLocationAt ? Date.parse(you.lastLocationAt) : 0;
        const nextMs = Date.parse(atIso);
        if (Number.isFinite(prevMs) && Number.isFinite(nextMs) && nextMs < prevMs) {
          return prev;
        }
        const members = prev.members.slice();
        members[idx] = { ...you, lastLocationAt: atIso };
        return { ...prev, members };
      });
    },
    onLocalFix: (fix) => {
      // Optimistic self pin — don't wait for the server round-trip to slide.
      setState((prev) => {
        if (!prev) return prev;
        const idx = prev.members.findIndex((m) => m.isYou);
        if (idx < 0) return prev;
        const you = prev.members[idx]!;
        // Optimistic: prefer walk when speed is foot-pace. Do NOT keep prior
        // "moving" through speed≈0 — that stuck Walking after login while sitting.
        // Server hysteresis covers brief mid-walk GPS zeros.
        const presence =
          fix.speedKmh != null && fix.speedKmh >= 14
            ? "driving"
            : fix.speedKmh != null && fix.speedKmh >= 1.5 && fix.speedKmh < 8
              ? "moving"
              : fix.speedKmh != null && fix.speedKmh < 1.5
                ? "stationary"
                : // Mid band (8–13): keep prior label — stops Walking↔Driving flicker.
                  you.presence === "driving" && (fix.speedKmh ?? 0) >= 10
                  ? "driving"
                  : you.presence === "moving" && (fix.speedKmh ?? 0) >= 1.5
                    ? "moving"
                    : you.presence === "stationary" || you.presence === "unknown"
                      ? you.presence
                      : "stationary";
        const walking =
          presence === "moving" &&
          (fix.speedKmh == null ||
            fix.speedKmh < 8 ||
            (fix.speedKmh >= 1.5 && fix.speedKmh < 8));
        const members = prev.members.slice();
        members[idx] = {
          ...you,
          lat: fix.lat,
          lng: fix.lng,
          speedKmh: fix.speedKmh,
          headingDeg: fix.headingDeg,
          presence,
          lastLocationAt: new Date().toISOString(),
          statusLabel:
            presence === "driving"
              ? you.likelyDestination && you.etaMinutes != null
                ? `Driving to ${you.likelyDestination} · ETA ${you.etaMinutes} min`
                : "Driving"
              : presence === "moving"
                ? walking
                  ? you.placeName
                    ? `Walking near ${you.placeName}`
                    : "Walking"
                  : "On the move"
                : presence === "stationary" && you.placeName
                  ? `At ${you.placeName}`
                  : presence === "stationary"
                    ? "Stationary"
                    : you.statusLabel,
        };
        return { ...prev, members };
      });
    },
    onDenied: () => {
      // Explicit OS deny — only then stop native Always / SecureStore share flag.
      stopBackgroundLocationSharing();
      setShareLive(false);
      writeShareLivePreference(false);
    },
    memberId: youMember?.id ?? null,
    placeName: youMember?.placeName ?? null,
    vehicle: state?.you.vehicle
      ? {
          fuelType: state.you.vehicle.fuelType,
          litresPer100km: state.you.vehicle.litresPer100km,
          kwhPer100km: state.you.vehicle.kwhPer100km,
          fuelPriceCadPerLitre: state.you.vehicle.fuelPriceCadPerLitre,
          evPriceCadPerKwh: state.you.vehicle.evPriceCadPerKwh,
        }
      : null,
    onLocalTripComplete: () => setHistoryRefreshKey((n) => n + 1),
  });

  async function enableLocationSharing() {
    if (isFixedHomeMember(youMember?.displayName)) {
      setShareLive(false);
      writeShareLivePreference(false);
      stopBackgroundLocationSharing();
      setNativeLocationPaused(true);
      setLocationHint(FAMILY_FIXED_HOME_HINT);
      return;
    }
    setEnablingLocation(true);
    setLocationHint(null);
    clearError();
    // iOS: ensure Settings → MotiveLife gets Location/Photos/Mic rows by touching
    // the real authorization APIs (plist strings alone never create them).
    if (getNativeShellPlatform() === "ios") {
      requestNativePrivacyPermissions();
    }
    // Hard failsafe — WebView geolocation can hang forever without settling
    const failSafeMs = getNativeShellPlatform() === "android" ? 75_000 : 60_000;
    const failSafe = window.setTimeout(() => {
      setEnablingLocation(false);
      setShareLive(false);
      writeShareLivePreference(false);
      setLocationHint(
        getNativeShellPlatform() === "ios"
          ? 'GPS timed out. Settings → MotiveLife → Location must be While Using the App — “When I Share” is not enough. Then tap Enable location again.'
          : getNativeShellPlatform() === "android"
            ? "Location timed out waiting for a GPS pin. Keep MotiveLife open with phone Location on, then tap Allow location again."
            : isNativeShell()
              ? "Location timed out. Open phone Settings → MotiveLife → Location → Allow, then try again."
              : "Location timed out. Check browser location permission and try again."
      );
    }, failSafeMs);
    try {
      const access = await requestLocationAccess();
      refreshLocationDiag();
      if (!access.ok) {
        setShareLive(false);
        writeShareLivePreference(false);
        setLocationHint(access.message);
        return;
      }
      setShareLive(true);
      writeShareLivePreference(true);
      // Post the GPS sample from the permission grant immediately (native WebView
      // cannot rely on navigator.geolocation for the first pin).
      if (access.fix) {
        const posted = await postFamilyLocationFix({
          lat: access.fix.lat,
          lng: access.fix.lng,
          accuracyM: access.fix.accuracyM,
          speedKmh: access.fix.speedKmh,
          headingDeg: access.fix.headingDeg,
          recordedAt: new Date().toISOString(),
        });
        if (posted.ok) {
          setState(posted.state);
          setLocationHint(
            access.message ??
              (access.backgroundGranted
                ? "Always location on — you’re on the map."
                : "You’re on the map. Set Location to Always for background sharing.")
          );
        } else {
          setLocationHint(
            `${posted.error} Location permission is on — retrying live updates.`
          );
          void pushImmediateLocationFix();
        }
      } else {
        setLocationHint(
          access.message ??
            (access.backgroundGranted
              ? "Always location on — your pin updates in the background."
              : "Location on — your pin will update live. Set Location to Always / Allow all the time for background sharing.")
        );
        void pushImmediateLocationFix();
      }
    } finally {
      window.clearTimeout(failSafe);
      setEnablingLocation(false);
      refreshLocationDiag();
    }
  }

  function disableLocationSharing() {
    stopBackgroundLocationSharing();
    setShareLive(false);
    writeShareLivePreference(false);
    setLocationHint("Live location off.");
    clearError();
  }

  async function saveVehicle() {
    setVehicleBusy(true);
    setError(null);
    try {
      const yearNum = vehicleYear.trim() ? Number(vehicleYear) : null;
      const res = await fetch("/api/family/vehicle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: vehicleMake.trim(),
          model: vehicleModel.trim(),
          year: yearNum != null && Number.isFinite(yearNum) ? yearNum : null,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as FamilyMapState;
      setState(data);
      if (data.you.vehicle) {
        setVehicleMake(data.you.vehicle.make);
        setVehicleModel(data.you.vehicle.model);
        setVehicleYear(data.you.vehicle.year != null ? String(data.you.vehicle.year) : "");
      }
    } finally {
      setVehicleBusy(false);
    }
  }

  const mapMembers: FamilyMapMemberView[] = useMemo(() => {
    if (!state) return [];
    if (circleTab === "friends" && friends?.activeCircle) {
      return friends.activeCircle.members.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        relationshipLabel: null,
        role: (m.isYou ? "OWNER" : "MEMBER") as "OWNER" | "MEMBER",
        color: m.color,
        isYou: m.isYou,
        isSimulated: false,
        locationSharingLevel: "precise" as LocationSharingLevel,
        presence: m.lat != null ? ("stationary" as const) : ("unknown" as const),
        statusLabel: m.statusLabel,
        lat: m.lat,
        lng: m.lng,
        speedKmh: null,
        headingDeg: null,
        batteryPercent: m.batteryPercent,
        lastLocationAt: m.lastLocationAt,
        placeName: null,
        placeCategory: null,
        likelyDestination: null,
        destinationConfidence: null,
        etaMinutes: null,
        timeAtPlaceMinutes: null,
        driveScoreRecent: null,
        phoneNumber: null,
        avatarUrl: null,
        vehicleLabel: null,
      }));
    }
    return state.members;
  }, [circleTab, friends, state]);

  const selected = useMemo(
    () => mapMembers.find((m) => m.id === selectedId) ?? null,
    [selectedId, mapMembers]
  );

  function clearPlaceUi() {
    setSelectedPlaceId(null);
    setPlaceEdit(null);
    setPlaceSheetMode("menu");
  }

  function backToFamilyMap() {
    setSheetOpen(false);
    setFollowSelected(false);
    setHistoryTrip(null);
    setVisitedPlaces([]);
  }

  /** Selecting a drive owns the map — close the sheet so history doesn't cover it. */
  function selectHistoryTrip(trip: LocalHistoryTrip | null) {
    setVisitedPlaces([]);
    if (!trip) {
      historyOwnerRef.current = null;
      historySelectGenRef.current += 1;
      setHistoryTrip(null);
      setDrivePager(null);
      setHistoryDrives([]);
      return;
    }

    // Drop stale async selections from a previous person (Hamoudi → daughter race).
    const ownerId = trip.memberId || selectedIdRef.current;
    if (
      ownerId &&
      selectedIdRef.current &&
      ownerId !== selectedIdRef.current
    ) {
      return;
    }

    const gen = ++historySelectGenRef.current;
    historyOwnerRef.current = ownerId;

    setSheetOpen(false);
    setFollowSelected(true);
    if (ownerId) setSelectedId(ownerId);
    const path =
      trip.path?.filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng) &&
          !(p.lat === 0 && p.lng === 0)
      ) ?? [];

    // Show immediately, then road-snap so long BG chords don't stay on screen.
    let working: LocalHistoryTrip = {
      ...trip,
      memberId: ownerId || trip.memberId,
      path,
    };
    if (path.length < 2) {
      const startOk =
        Number.isFinite(trip.startLat) &&
        Number.isFinite(trip.startLng) &&
        !(trip.startLat === 0 && trip.startLng === 0);
      const endOk =
        Number.isFinite(trip.endLat) &&
        Number.isFinite(trip.endLng) &&
        !(trip.endLat === 0 && trip.endLng === 0);
      if (startOk && endOk) {
        working = {
          ...working,
          path: [
            {
              lat: trip.startLat,
              lng: trip.startLng,
              t: trip.startedAt,
              speedKmh: null,
            },
            {
              lat: trip.endLat,
              lng: trip.endLng,
              t: trip.endedAt,
              speedKmh: null,
            },
          ],
        };
      }
    }
    setHistoryTrip(working);

    if (working.path.length >= 2) {
      void (async () => {
        try {
          const { enrichPathWithRoadRoute } = await import(
            "@/lib/family-map/road-route"
          );
          // Prefer GPS breadcrumbs; only A→B gets estimated road directions.
          const routed = await enrichPathWithRoadRoute(working.path, {
            force: working.path.length <= 2,
          });
          if (routed.length < 2) return;
          if (historySelectGenRef.current !== gen) return;
          if (
            historyOwnerRef.current &&
            selectedIdRef.current &&
            historyOwnerRef.current !== selectedIdRef.current
          ) {
            return;
          }
          setHistoryTrip((prev) => {
            if (!prev || prev.id !== working.id) return prev;
            if (
              prev.memberId &&
              selectedIdRef.current &&
              prev.memberId !== selectedIdRef.current
            ) {
              return prev;
            }
            return {
              ...prev,
              path: routed.map((p) => ({
                lat: p.lat,
                lng: p.lng,
                t: p.t ?? new Date().toISOString(),
                speedKmh: p.speedKmh ?? null,
              })),
            };
          });
        } catch {
          // Keep the raw path if routing fails.
        }
      })();
    }
  }

  // Load today's drives for the followed member so ◀/▶ work without the list panel.
  useEffect(() => {
    if (!historyTrip || !selectedId || circleTab !== "family") {
      if (!historyTrip) setHistoryDrives([]);
      return;
    }
    const memberId = selectedId;
    const ac = new AbortController();
    void (async () => {
      try {
        // Prefer day, fall back to month so sparse days still have neighbors.
        for (const range of ["day", "month"] as const) {
          const tz = new Date().getTimezoneOffset();
          const res = await fetch(
            `/api/family/history?memberId=${encodeURIComponent(memberId)}&range=${range}&tzOffsetMinutes=${tz}`,
            { signal: ac.signal }
          );
          if (!res.ok) continue;
          const data = (await res.json()) as { items?: FamilyHistoryItem[] };
          const drives = (data.items ?? [])
            .filter((i): i is Extract<FamilyHistoryItem, { kind: "drive" }> => i.kind === "drive")
            .map((i) => i.trip);
          if (ac.signal.aborted) return;
          if (drives.length > 0 || range === "month") {
            setHistoryDrives(drives);
            return;
          }
        }
      } catch {
        // optional — pager still shows current drive
      }
    })();
    return () => ac.abort();
  }, [historyTrip?.id, selectedId, circleTab, historyRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const historyDriveIndex = useMemo(() => {
    if (!historyTrip || historyDrives.length === 0) return -1;
    const byId = historyDrives.findIndex(
      (t) =>
        t.id === historyTrip.id ||
        `cloud-${t.fromLabel}-${t.toLabel}-${t.startedAt ?? ""}` === historyTrip.id
    );
    if (byId >= 0) return byId;
    const hintMs = Date.parse(historyTrip.startedAt);
    let best = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < historyDrives.length; i++) {
      const t = historyDrives[i]!;
      const tMs = Date.parse(t.startedAt ?? t.endedAt ?? "");
      if (!Number.isFinite(tMs) || !Number.isFinite(hintMs)) continue;
      const delta = Math.abs(tMs - hintMs);
      const labelOk =
        t.fromLabel === historyTrip.fromLabel || t.toLabel === historyTrip.toLabel;
      if (delta <= 15 * 60_000 && delta < bestDelta && (labelOk || delta <= 3 * 60_000)) {
        best = i;
        bestDelta = delta;
      }
    }
    return best;
  }, [historyTrip, historyDrives]);

  async function stepHistoryDrive(delta: -1 | 1) {
    if (!selectedId || historyDrives.length === 0) return;
    const idx = historyDriveIndex >= 0 ? historyDriveIndex : 0;
    const next = historyDrives[idx + delta];
    if (!next) return;
    const forMember = selectedId;
    setHistoryStepBusy(true);
    try {
      let path = next.id ? await fetchRouteForDriveTrip(next, forMember) : [];
      if (path.length < 2) {
        const startOk =
          next.startLat != null &&
          next.startLng != null &&
          Number.isFinite(next.startLat) &&
          Number.isFinite(next.startLng);
        const endOk =
          next.endLat != null &&
          next.endLng != null &&
          Number.isFinite(next.endLat) &&
          Number.isFinite(next.endLng);
        if (startOk && endOk) {
          path = [
            {
              lat: next.startLat!,
              lng: next.startLng!,
              t: next.startedAt ?? new Date().toISOString(),
              speedKmh: null,
            },
            {
              lat: next.endLat!,
              lng: next.endLng!,
              t: next.endedAt ?? new Date().toISOString(),
              speedKmh: null,
            },
          ];
        }
      }
      if (path.length < 2) {
        setError("No route points for that drive yet.");
        return;
      }
      selectHistoryTrip({
        id: next.id ?? `cloud-${next.fromLabel}-${next.toLabel}-${next.startedAt ?? ""}`,
        memberId: forMember,
        fromLabel: next.fromLabel,
        toLabel: next.toLabel,
        startLat: path[0]!.lat,
        startLng: path[0]!.lng,
        endLat: path[path.length - 1]!.lat,
        endLng: path[path.length - 1]!.lng,
        path,
        distanceKm: next.distanceKm,
        durationMinutes: next.durationMinutes,
        avgSpeedKmh: next.avgSpeedKmh,
        maxSpeedKmh: next.maxSpeedKmh,
        estimatedFuelLitres: next.estimatedFuelLitres ?? null,
        estimatedFuelKwh: next.estimatedFuelKwh ?? null,
        estimatedFuelCostCad: next.estimatedFuelCostCad ?? null,
        driveScore: next.driveScore,
        hardBraking: next.hardBraking,
        rapidAcceleration: next.rapidAcceleration,
        unusualRouteEvents: next.unusualRouteEvents,
        startedAt: next.startedAt ?? new Date().toISOString(),
        endedAt: next.endedAt ?? new Date().toISOString(),
      });
    } finally {
      setHistoryStepBusy(false);
    }
  }

  function selectMember(id: string) {
    // Life360 two-tap flow:
    // 1) First tap → zoom/follow only (live speed / walking).
    // 2) Tap the same person again → open history + intel sheet.
    clearPlaceUi();
    setShowTools(false);
    setPlaceDraft(null);

    if (followSelected && selectedId === id) {
      // Opening the sheet while following — drop any leftover route overlay
      // so live driving isn't covered by a previous history click.
      historyOwnerRef.current = null;
      historySelectGenRef.current += 1;
      setHistoryTrip(null);
      setVisitedPlaces([]);
      setSheetOpen(true);
      return;
    }

    setSelectedId(id);
    setFollowSelected(true);
    setSheetOpen(false);
    // selectedId effect also clears history; do it here for same-tick UI.
    historyOwnerRef.current = null;
    historySelectGenRef.current += 1;
    setHistoryTrip(null);
    setVisitedPlaces([]);
  }

  function openMemberDetails(id: string) {
    historyOwnerRef.current = null;
    historySelectGenRef.current += 1;
    setHistoryTrip(null);
    setVisitedPlaces([]);
    setSelectedId(id);
    setFollowSelected(true);
    setSheetOpen(true);
    setShowTools(false);
    setPlaceDraft(null);
    clearPlaceUi();
  }

  function selectPlace(id: string) {
    const place = state?.places.find((p) => p.id === id);
    if (!place) return;
    setSelectedPlaceId(id);
    setPlaceEdit({
      id: place.id,
      lat: place.lat,
      lng: place.lng,
      radiusM: Math.round(place.radiusM),
      shape: place.shape === "square" ? "square" : "circle",
    });
    setPlaceSheetMode("menu");
    setFollowSelected(false);
    setSheetOpen(false);
    setShowTools(false);
    setPlaceDraft(null);
  }

  function openHouseholdSettings() {
    setShowTools(true);
    setSheetOpen(false);
    setPlaceDraft(null);
    clearPlaceUi();
  }

  useEffect(() => {
    if (circleTab === "friends") {
      const first = friends?.activeCircle?.members[0];
      if (first) setSelectedId(first.id);
      setSheetOpen(false);
    } else if (state?.members[0]) {
      setSelectedId(state.members[0].id);
      setSheetOpen(false);
    }
  }, [circleTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function joinFamily() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: joinCode,
          // Prefer the name they typed in Tools; avoids invitees showing as "Me".
          displayName: displayNameDraft.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
      setJoinCode("");
      setShowTools(false);
      // After joining, push a fresh GPS fix onto the shared household row so
      // the owner (and your own pin) appear immediately.
      if (shareLive) {
        void pushImmediateLocationFix();
      } else {
        setLocationHint(
          "Joined your family. Allow location once if prompted — then you’ll appear on the map."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function shareFamilyInvite() {
    const code = state?.household.inviteCode;
    if (!code) return;
    setInviteShareHint(null);
    const url = familyInviteUrl(code);
    const text = familyInviteShareText(code);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Join my family on MyMotiveFamily",
          text,
          url,
        });
        setInviteShareHint("Invite shared.");
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setInviteShareHint("Invite link copied — paste it in WhatsApp, Messages, or email.");
    } catch {
      setInviteShareHint(`Copy this link: ${url}`);
    }
  }

  async function pushImmediateLocationFix(opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    try {
      if (canUseNativeLocationBridge()) {
        const result = await requestNativeLocationFix({
          timeoutMs: getNativeShellPlatform() === "android" ? 28_000 : 18_000,
          silent,
        });
        if (!result.ok) {
          // Silent resume must not clear Share Live or force another Allow tap.
          if (!silent) setLocationHint(result.message);
          return;
        }
        const posted = await postFamilyLocationFix({
          lat: result.fix.lat,
          lng: result.fix.lng,
          accuracyM: result.fix.accuracyM,
          speedKmh: result.fix.speedKmh,
          headingDeg: result.fix.headingDeg,
          recordedAt: result.fix.recordedAt ?? new Date().toISOString(),
        });
        if (posted.ok) {
          setState(posted.state);
          writeShareLivePreference(true);
        } else if (!silent) {
          setLocationHint(posted.error);
        }
        return;
      }

      if (!navigator?.geolocation) return;
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void postFamilyLocationFix({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracyM: pos.coords.accuracy,
              speedKmh:
                pos.coords.speed != null && Number.isFinite(pos.coords.speed)
                  ? Math.max(0, pos.coords.speed * 3.6)
                  : null,
              headingDeg: pos.coords.heading,
              recordedAt: new Date(pos.timestamp).toISOString(),
            }).then((posted) => {
              if (posted.ok) {
                setState(posted.state);
                writeShareLivePreference(true);
              } else if (!silent) {
                setLocationHint(posted.error);
              }
              resolve();
            });
          },
          (err) => {
            if (!silent) {
              setLocationHint(err.message || "Could not get GPS yet. Pull to refresh Family Map.");
            }
            resolve();
          },
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 }
        );
      });
    } catch {
      // live watch will retry
    }
  }

  async function createFriendsCircle() {
    setBusy(true);
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Buddies", type: "FRIENDS" }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      await refreshFriends();
      setCircleTab("friends");
    } finally {
      setBusy(false);
    }
  }

  async function joinFriendsCircle() {
    setBusy(true);
    try {
      const res = await fetch("/api/circles/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      await refreshFriends();
      setJoinCode("");
      setCircleTab("friends");
    } finally {
      setBusy(false);
    }
  }

  async function updateMemberKind(kind: "ADULT" | "TEEN" | "CHILD") {
    setBusy(true);
    try {
      const res = await fetch("/api/family/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberKind: kind }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
    } finally {
      setBusy(false);
    }
  }

  async function renameHousehold() {
    const name = householdNameDraft.trim();
    if (!name) {
      setError("Enter a household name.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/family/household", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as FamilyMapState;
      setState(data);
      setHouseholdNameDraft(data.household.name);
      setError(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveDisplayName() {
    const displayName = displayNameDraft.trim();
    if (!displayName) {
      setError("Enter a display name.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/family/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as FamilyMapState;
      setState(data);
      const you = data.members.find((m) => m.isYou);
      if (you) setDisplayNameDraft(you.displayName);
      setError(null);
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarSelected(file: File | null) {
    if (!file) return;
    setAvatarBusy(true);
    setError(null);
    try {
      const avatarDataUrl = await resizeImageFile(file);
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  if (loading && !state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-2xl bg-[#e8eef5] text-sm text-forward-500">
        Loading your map…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p>{error ?? "Could not load Family Map."}</p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            setLoading(true);
            setError(null);
            const controller = new AbortController();
            const failSafe = window.setTimeout(() => controller.abort(), 20_000);
            void refresh(controller.signal)
              .catch((e) => {
                const aborted = e instanceof DOMException && e.name === "AbortError";
                setError(
                  aborted
                    ? "Map is taking too long on this connection. Tap Try again."
                    : e instanceof Error && e.message
                      ? e.message
                      : "Could not load Family Map."
                );
              })
              .finally(() => {
                window.clearTimeout(failSafe);
                setLoading(false);
              });
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const mapPlaces = circleTab === "family" ? state.places : [];

  const resizingPlace = Boolean(placeEdit && placeSheetMode === "resize");

  const mapBlock = (
    <div className={expanded ? "contents" : "space-y-2"}>
    <div
      ref={mapAnchorRef}
      className={
        expanded
          ? "fixed inset-0 z-[80] bg-white"
            : historyTrip
            ? "relative z-0 mx-2 h-[min(78dvh,720px)] min-h-[320px] overflow-hidden rounded-[1.5rem] border border-forward-200/80 bg-[#e8eef5] max-[380px]:mx-1.5 sm:mx-3 sm:h-[min(78vh,780px)]"
            : "relative z-0 mx-2 h-[min(72dvh,680px)] min-h-[300px] overflow-hidden rounded-[1.5rem] border border-forward-200/80 bg-[#e8eef5] max-[380px]:mx-1.5 max-[380px]:h-[min(76dvh,700px)] sm:mx-3 sm:h-[min(74vh,760px)] sm:min-h-[400px]"
      }
    >
      {/* Clip chrome on an outer shell — overflow-hidden on the Leaflet host
          desyncs SVG/canvas overlays from tiles in iOS WKWebView pinch-zoom. */}
      <div className={expanded ? "h-full w-full" : "h-full w-full overflow-hidden rounded-2xl"}>
      <FamilyLeafletMap
        members={mapMembers}
        places={mapPlaces}
        selectedMemberId={selectedId}
        onSelectMember={selectMember}
        followSelected={followSelected && !selectedPlaceId && !historyTrip}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={selectPlace}
        editingGeofence={resizingPlace ? placeEdit : null}
        onGeofenceChange={setPlaceEdit}
        focusGeofenceOnly={resizingPlace}
        onMapClick={(lat, lng) => {
          if (circleTab !== "family") return;
          if (resizingPlace) return;
          setPlaceDraft({ lat, lng, label: "Dropped pin" });
          setShowTools(false);
          setSheetOpen(false);
          clearPlaceUi();
        }}
        draftPin={
          circleTab === "family" && placeDraft
            ? { lat: placeDraft.lat, lng: placeDraft.lng }
            : null
        }
        expanded={expanded}
        layoutKey={`tools:${showTools ? 1 : 0}|pin:${placeDraft ? 1 : 0}|place:${placeSheetMode}|member:${sheetOpen ? 1 : 0}|follow:${followSelected ? 1 : 0}|route:${historyTrip ? 1 : 0}`}
        bottomPad={
          resizingPlace
            ? 120
            : selectedPlaceId
              ? 200
              : historyTrip
                ? expanded
                  ? 140
                  : 100
                : sheetOpen
                  ? 240
                  : circleTab === "family" && !expanded
                    ? 110
                    : 48
        }
        routePath={historyTrip?.path ?? null}
        visitedPlaces={visitedPlaces}
        mapStyle={mapStyle}
        showPlaceFences={showPlaceFences && !historyTrip}
        placeLabelsMode={historyTrip ? "off" : placeLabelsMode}
      />
      </div>

      {/* Top chrome — Family/Friends + settings always stay visible */}
      {!resizingPlace ? (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-2 max-[380px]:p-1.5 sm:p-3">
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <div className="pointer-events-auto flex items-center gap-1.5">
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
                  className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition max-[380px]:px-2 ${
                    circleTab === id
                      ? "bg-forward-900 text-white"
                      : "text-forward-600 hover:bg-forward-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 text-forward-700 shadow-md"
              aria-label={expanded ? "Exit full map" : "Expand map"}
              title={expanded ? "Exit full map" : "Expand map"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </button>
          </div>
          <div className="pointer-events-auto flex shrink-0 flex-nowrap items-center justify-end gap-1.5">
            {circleTab === "family" ? (
              fixedHomeForYou ? (
                <span className="inline-flex h-10 max-w-[8.5rem] items-center truncate rounded-full bg-white/95 px-2.5 text-[11px] font-semibold text-forward-700 shadow-md sm:max-w-none sm:px-3 sm:text-xs">
                  At Home
                </span>
              ) : shareLive ? (
                <span className="inline-flex h-10 max-w-[7.5rem] items-center truncate rounded-full bg-white/95 px-2.5 text-[11px] font-semibold text-emerald-800 shadow-md sm:max-w-none sm:px-3 sm:text-xs">
                  Live
                  {lastFixAt
                    ? ` · ${new Date(lastFixAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : ""}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={enablingLocation || busy}
                  onClick={() => void enableLocationSharing()}
                  className="inline-flex h-10 items-center rounded-full bg-forward-900 px-3 text-xs font-semibold text-white shadow-md"
                >
                  {enablingLocation ? "…" : "Allow location"}
                </button>
              )
            ) : null}
            <button
              type="button"
              onClick={() => openHouseholdSettings()}
              className="relative z-[1] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 text-forward-700 shadow-md"
              aria-label="Family settings"
              title="Family settings — places, zones, and more"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setMapStyle((s) => (s === "streets" ? "satellite" : "streets"))
              }
              className="relative z-[1] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 text-forward-700 shadow-md"
              aria-label={mapStyle === "streets" ? "Satellite map" : "Street map"}
              title={mapStyle === "streets" ? "Satellite" : "Streets"}
            >
              <Layers className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      ) : null}

      {/* Family cards float on the map */}
      {!resizingPlace &&
      !selectedPlaceId &&
      !historyTrip &&
      !sheetOpen &&
      circleTab === "family" &&
      mapMembers.length > 0 ? (
        <FamilyMapPeopleStrip
          members={mapMembers}
          selectedId={selectedId}
          detailOpen={followSelected}
          onSelectMember={(id) => selectMember(id)}
        />
      ) : null}

      {/* Expanded map: keep ◀/▶ at the bottom of the fullscreen shell */}
      {historyTrip && expanded ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <div className="pointer-events-auto">
            <HistoryDrivePagerBar
              fromLabel={historyTrip.fromLabel}
              toLabel={historyTrip.toLabel}
              whenLabel={new Date(historyTrip.startedAt).toLocaleString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              index={historyDriveIndex >= 0 ? historyDriveIndex : 0}
              total={Math.max(
                historyDrives.length,
                historyDriveIndex >= 0 ? historyDrives.length : 1
              )}
              canPrev={historyDrives.length > 1 && historyDriveIndex > 0}
              canNext={
                historyDrives.length > 1 &&
                historyDriveIndex >= 0 &&
                historyDriveIndex < historyDrives.length - 1
              }
              busy={historyStepBusy}
              onPrev={() => void stepHistoryDrive(-1)}
              onNext={() => void stepHistoryDrive(1)}
              onClear={() => selectHistoryTrip(null)}
              className="mx-2 rounded-[1.25rem] bg-forward-900 px-2 py-2 text-white shadow-[0_12px_28px_-16px_rgba(10,25,48,0.55)] max-[380px]:mx-1.5 sm:mx-3"
            />
          </div>
        </div>
      ) : null}

    </div>

      {/* History pager under the map on the main (non-expanded) layout */}
      {historyTrip && !expanded ? (
        <HistoryDrivePagerBar
          fromLabel={historyTrip.fromLabel}
          toLabel={historyTrip.toLabel}
          whenLabel={new Date(historyTrip.startedAt).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          index={historyDriveIndex >= 0 ? historyDriveIndex : 0}
          total={Math.max(historyDrives.length, historyDriveIndex >= 0 ? historyDrives.length : 1)}
          canPrev={historyDrives.length > 1 && historyDriveIndex > 0}
          canNext={
            historyDrives.length > 1 &&
            historyDriveIndex >= 0 &&
            historyDriveIndex < historyDrives.length - 1
          }
          busy={historyStepBusy}
          onPrev={() => void stepHistoryDrive(-1)}
          onNext={() => void stepHistoryDrive(1)}
          onClear={() => selectHistoryTrip(null)}
        />
      ) : null}

      {/* Person detail under the map — pushes Family Brief down */}
      {!expanded &&
      followSelected &&
      !resizingPlace &&
      !selectedPlaceId &&
      !historyTrip &&
      !sheetOpen &&
      circleTab === "family" &&
      state &&
      mapMembers.length > 0 ? (
        <FamilyMapPersonDetail
          members={mapMembers}
          selectedId={selectedId}
          state={state}
          intelligenceUnlocked={intelligenceUnlocked}
          onOpenDetails={(id) => openMemberDetails(id)}
          onCloseDetail={() => backToFamilyMap()}
        />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {sheetOpen && selected ? (
        <MemberIntelSheet
          member={selected}
          state={state}
          anchorRef={mapAnchorRef}
          onClose={() => {
            // Close the sheet only — keep any drive route on the map.
            setSheetOpen(false);
          }}
          onMemberUpdated={setState}
          historyRefreshKey={historyRefreshKey}
          selectedHistoryTripId={historyTrip?.id ?? null}
          onSelectHistoryTrip={selectHistoryTrip}
          onHighlightPlaces={setVisitedPlaces}
          onSavePlaceAtMember={(m) => {
            if (m.lat == null || m.lng == null) return;
            setPlaceDraft({ lat: m.lat, lng: m.lng, label: m.displayName });
            setSheetOpen(false);
            setShowTools(false);
            clearPlaceUi();
          }}
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {/* Alerts / location help only — Something’s Different lives in Family Intelligence */}
      {circleTab === "family" &&
      (state.areaIntel?.alerts?.[0] || locationHint || shareError) ? (
        <div className="rounded-xl border border-forward-200 bg-white px-2.5 py-1.5">
          {state.areaIntel?.alerts?.[0] ? (
            <p
              className={`text-[11px] ${
                state.areaIntel.alerts[0].severity === "warning"
                  ? "text-red-800"
                  : state.areaIntel.alerts[0].severity === "watch"
                    ? "text-amber-800"
                    : "text-forward-600"
              }`}
            >
              <span className="font-semibold">{state.areaIntel.alerts[0].title}.</span>{" "}
              {state.areaIntel.alerts[0].body}
            </p>
          ) : null}
          {!shareLive && (locationHint || shareError) ? (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
              <p className="whitespace-pre-wrap text-[11px] text-amber-950">
                {locationHint || shareError}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <button
                  type="button"
                  disabled={enablingLocation || busy}
                  onClick={() => void enableLocationSharing()}
                  className="text-[11px] font-semibold text-forward-900 underline"
                >
                  {enablingLocation ? "Asking…" : "Try again"}
                </button>
                {isNativeShell() ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-brand-blue underline"
                    onClick={() => {
                      if (!tryOpenAppSettings()) {
                        setLocationHint(
                          getNativeShellPlatform() === "ios"
                            ? "Settings → MotiveLife → Location → While Using / Always."
                            : "Settings → Apps → MotiveLife → Permissions → Location → Allow."
                        );
                      }
                    }}
                  >
                    App permissions
                  </button>
                ) : null}
                {getNativeShellPlatform() === "android" ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-brand-blue underline"
                    onClick={() => {
                      if (!tryOpenLocationSettings()) {
                        setLocationHint("Settings → Location → turn Location on.");
                      }
                    }}
                  >
                    Phone GPS
                  </button>
                ) : null}
              </div>
              {locationDiag ? (
                <p className="mt-1 text-[10px] text-forward-500">{locationDiag}</p>
              ) : null}
            </div>
          ) : null}
          {shareLive && (locationHint || shareError) ? (
            <p className="text-[11px] text-amber-800">{locationHint || shareError}</p>
          ) : null}
        </div>
      ) : null}

      {mapBlock}

      {!expanded && circleTab === "friends" ? (
        <FriendsCirclePanel
          friends={friends}
          busy={busy}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          onCreate={() => void createFriendsCircle()}
          onJoin={() => void joinFriendsCircle()}
          onOpenFamilyMap={() => setCircleTab("family")}
        />
      ) : null}

      {!expanded && circleTab === "family" ? (
        <div className="space-y-3">
          {fixedHomeForYou ? (
            <div className="relative overflow-hidden rounded-[1.35rem] bg-forward-50 px-4 py-3 shadow-sm ring-1 ring-forward-100/90 text-sm text-forward-900">
              <p className="font-semibold">Shown at Home</p>
              <p className="mt-0.5 text-xs text-forward-800/80">{FAMILY_FIXED_HOME_HINT}</p>
            </div>
          ) : !shareLive ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">
                {osLocationGranted ? "Place your pin on the map" : "Improve your location accuracy"}
              </p>
              <p className="mt-0.5 text-xs text-amber-900/80">
                {osLocationGranted
                  ? "Location is already allowed on this phone. Tap below to start live sharing so your family can see you."
                  : "Allow location once so your pin stays precise — Wi‑Fi and GPS both help."}
              </p>
              <button
                type="button"
                disabled={enablingLocation || busy}
                onClick={() => void enableLocationSharing()}
                className="mt-2 rounded-full bg-forward-900 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {enablingLocation
                  ? "…"
                  : osLocationGranted
                    ? "Start live sharing"
                    : "Allow location"}
              </button>
            </div>
          ) : null}

          {followSelected && selected ? (
            intelligenceUnlocked ? (
              <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-forward-100/90 sm:p-4">
                {!historyTrip ? (
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-base font-semibold text-forward-900">
                        {selected.displayName}’s day
                      </p>
                      <p className="text-xs text-forward-500">
                        {selected.statusLabel}
                        {selected.batteryPercent != null
                          ? ` · ${selected.batteryPercent}% battery`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => backToFamilyMap()}
                      className="rounded-full bg-forward-100 px-3 py-1.5 text-xs font-semibold text-forward-800"
                    >
                      Family map
                    </button>
                  </div>
                ) : null}
                {/* Keep one panel mounted so drive list + pager survive selection. */}
                <LocationHistoryPanel
                  memberId={selected.id}
                  memberName={selected.displayName}
                  isYou={selected.isYou}
                  refreshKey={historyRefreshKey}
                  selectedTripId={historyTrip?.id ?? null}
                  selectedTripHint={
                    historyTrip
                      ? {
                          fromLabel: historyTrip.fromLabel,
                          toLabel: historyTrip.toLabel,
                          startedAt: historyTrip.startedAt,
                          distanceKm: historyTrip.distanceKm,
                        }
                      : null
                  }
                  mapFirst
                  onSelectTrip={selectHistoryTrip}
                  onHighlightPlaces={setVisitedPlaces}
                  onDrivePagerChange={setDrivePager}
                />
              </section>
            ) : (
              <div className="space-y-3">
                <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-forward-100/90">
                  <p className="text-sm font-semibold text-forward-900">
                    Following {selected.displayName}
                    {selected.speedKmh != null
                      ? ` · ${Math.round(selected.speedKmh)} km/h`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-forward-500">
                    Live map + speed stay free. History and Drive Score unlock below.
                  </p>
                  <button
                    type="button"
                    onClick={() => backToFamilyMap()}
                    className="mt-2 rounded-full bg-forward-100 px-3 py-1.5 text-xs font-semibold text-forward-800"
                  >
                    Family map
                  </button>
                </section>
                <FamilyIntelLockedPreview
                  state={state}
                  canUpgrade={state.entitlements?.canUpgrade ?? false}
                  onUpgraded={() => void refresh()}
                />
              </div>
            )
          ) : intelligenceUnlocked ? (
            <>
              <FamilyBriefCard
                state={state}
                onOpenMember={(id) => openMemberDetails(id)}
              />
              <div className="rounded-[1.35rem] bg-white/90 px-1 py-1 ring-1 ring-forward-100">
                <WeeklyDrivingReport onSelectMember={(id) => openMemberDetails(id)} />
              </div>
              <FamilyInboxPanel
                entitlements={state.entitlements}
                onRefreshMap={() => void refresh()}
              />
              <TemporaryCircleCard
                entitlements={state.entitlements}
                busy={busy}
                onRefreshMap={() => void refresh()}
              />
            </>
          ) : (
            <FamilyIntelLockedPreview
              state={state}
              canUpgrade={state.entitlements?.canUpgrade ?? false}
              onUpgraded={() => void refresh()}
            />
          )}
        </div>
      ) : null}

      {/* Portal to body so Leaflet can never stack above this sheet */}
      {portalReady &&
      circleTab === "family" &&
      showTools &&
      createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close family settings"
            onClick={() => {
              setShowTools(false);
            }}
          />
          <div className="relative z-10 flex max-h-[min(85vh,760px)] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-forward-100 px-4 py-3">
              <p className="font-display text-base font-semibold text-forward-900">
                Family settings
              </p>
              <button
                type="button"
                className="rounded-full bg-forward-100 px-3 py-1.5 text-sm font-semibold text-forward-800"
                onClick={() => {
                  setShowTools(false);
                }}
              >
                Done
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto overscroll-contain p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="relative overflow-hidden rounded-[1.5rem] bg-forward-50/70 p-4 shadow-sm ring-1 ring-forward-100/90">
                  <h3 className="font-display text-base font-semibold text-forward-900">
                    Live location
                  </h3>
                  <p className="mt-1 text-xs text-forward-500">
                    Your family always sees your precise location while location is allowed on this
                    phone. Set MotiveLife to Always / Allow all the time for background updates.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {fixedHomeForYou ? (
                      <span className="inline-flex h-10 items-center rounded-full bg-forward-100 px-3 text-xs font-semibold text-forward-800">
                        At Home · tracking paused
                      </span>
                    ) : shareLive ? (
                      <>
                        <span className="inline-flex h-10 items-center rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800">
                          {sharing
                            ? `Sharing live${
                                lastFixAt
                                  ? ` · ${new Date(lastFixAt).toLocaleTimeString()}`
                                  : ""
                              }`
                            : "Starting…"}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={enablingLocation || busy}
                          onClick={() => disableLocationSharing()}
                        >
                          Pause
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        disabled={enablingLocation || busy}
                        onClick={() => void enableLocationSharing()}
                      >
                        {enablingLocation ? "Asking…" : "Allow location"}
                      </Button>
                    )}
                  </div>
                  {(locationHint || shareError) && (
                    <p className="mt-2 text-xs text-amber-800">{locationHint || shareError}</p>
                  )}
                  <label className="mt-3 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-forward-300"
                      checked={state.you.shareDigitalTwinIntegration !== false}
                      disabled={busy}
                      onChange={(e) => {
                        void (async () => {
                          setBusy(true);
                          try {
                            const res = await fetch("/api/family/privacy", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                shareDigitalTwinIntegration: e.target.checked,
                              }),
                            });
                            if (!res.ok) {
                              setError(await readError(res));
                              return;
                            }
                            setState((await res.json()) as FamilyMapState);
                          } finally {
                            setBusy(false);
                          }
                        })();
                      }}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-forward-900">
                        Digital Twin Integration
                      </span>
                      <span className="mt-0.5 block text-xs text-forward-500">
                        With Pro, sync your own trips into Twin, Money fuel, and Travel — and notify
                        you. Never shares another adult’s Twin.
                      </span>
                    </span>
                  </label>
                  <label className="mt-3 block text-xs font-medium text-forward-600">
                    Account type
                    <select
                      className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
                      value={state.you.memberKind ?? "ADULT"}
                      onChange={(e) =>
                        updateMemberKind(e.target.value as "ADULT" | "TEEN" | "CHILD")
                      }
                      disabled={busy}
                    >
                      <option value="ADULT">Adult</option>
                      <option value="TEEN">Teen</option>
                      <option value="CHILD">Child (guardian care)</option>
                    </select>
                  </label>
                </section>

                <section className="relative overflow-hidden rounded-[1.5rem] bg-forward-50/70 p-4 shadow-sm ring-1 ring-forward-100/90">
                  <h3 className="font-display text-base font-semibold text-forward-900">
                    Household
                  </h3>
                  <p className="mt-1 text-sm font-medium text-forward-800">
                    {state.household.name}
                  </p>
                  {state.household.isOwner ? (
                    <label className="mt-3 block text-xs font-medium text-forward-600">
                      Family name
                      <div className="mt-1 flex gap-2">
                        <input
                          value={householdNameDraft}
                          onChange={(e) => setHouseholdNameDraft(e.target.value)}
                          className="flex-1 rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
                          placeholder="e.g. Our household"
                          maxLength={60}
                          disabled={busy}
                        />
                        <Button
                          type="button"
                          onClick={() => void renameHousehold()}
                          disabled={
                            busy ||
                            !householdNameDraft.trim() ||
                            householdNameDraft.trim() === state.household.name
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </label>
                  ) : null}
                  {state.household.isOwner && state.household.inviteCode ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm text-forward-600">
                        Invite code{" "}
                        <button
                          type="button"
                          onClick={() => void shareFamilyInvite()}
                          className="font-mono font-semibold text-brand-blue underline-offset-2 hover:underline"
                          title="Share invite link"
                        >
                          {state.household.inviteCode}
                        </button>
                      </p>
                      <p className="break-all text-xs text-forward-500">
                        {familyInviteUrl(state.household.inviteCode)}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={busy}
                        onClick={() => void shareFamilyInvite()}
                      >
                        Share invite link
                      </Button>
                      {inviteShareHint ? (
                        <p className="text-xs text-forward-600">{inviteShareHint}</p>
                      ) : (
                        <p className="text-xs text-forward-500">
                          Tap the code or Share — family can open the link from Texts, WhatsApp, or
                          email and join instantly.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-forward-600">
                      Ask the owner for an invite link or code to join.
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="flex-1 rounded-lg border border-forward-200 bg-white px-3 py-2 font-mono text-sm uppercase"
                      placeholder="Code"
                      maxLength={12}
                    />
                    <Button
                      type="button"
                      onClick={() => void joinFamily()}
                      disabled={busy || !joinCode}
                    >
                      Join
                    </Button>
                  </div>
                </section>
              </div>

              <FamilyMembersPanel
                members={state.members.filter((m) => !m.isSimulated)}
                isOwner={state.household.isOwner}
                inviteCode={state.household.inviteCode || null}
                busy={busy}
                onUpdated={(next) => {
                  setState(next);
                  setError(null);
                }}
                onError={(msg) => {
                  if (msg) setError(msg);
                }}
                onShareInvite={() => void shareFamilyInvite()}
              />

              <section className="relative overflow-hidden rounded-[1.5rem] bg-forward-50/70 p-4 shadow-sm ring-1 ring-forward-100/90">
                <h3 className="font-display text-base font-semibold text-forward-900">
                  Your vehicle
                </h3>
                <p className="mt-1 text-xs text-forward-500">
                  Enter make and model. We estimate engine type and fuel use, then track trip fuel
                  cost from your driving.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <label className="block text-xs font-medium text-forward-600 sm:col-span-1">
                    Make
                    <input
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
                      placeholder="Toyota"
                      disabled={vehicleBusy || busy}
                    />
                  </label>
                  <label className="block text-xs font-medium text-forward-600 sm:col-span-1">
                    Model
                    <input
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
                      placeholder="Rav4 Hybrid"
                      disabled={vehicleBusy || busy}
                    />
                  </label>
                  <label className="block text-xs font-medium text-forward-600 sm:col-span-1">
                    Year
                    <input
                      value={vehicleYear}
                      onChange={(e) => setVehicleYear(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
                      placeholder="2022"
                      inputMode="numeric"
                      disabled={vehicleBusy || busy}
                    />
                  </label>
                </div>
                {state.you.vehicle ? (
                  <p className="mt-2 text-xs text-forward-600">
                    {state.you.vehicle.engineSummary}
                    {state.you.fuelSummary.tripCount > 0
                      ? ` · $${state.you.fuelSummary.monthCad.toFixed(2)} this month`
                      : ""}
                  </p>
                ) : null}
                <Button
                  type="button"
                  className="mt-3"
                  disabled={
                    vehicleBusy || busy || !vehicleMake.trim() || !vehicleModel.trim()
                  }
                  onClick={() => void saveVehicle()}
                >
                  {vehicleBusy ? "Saving…" : "Save vehicle"}
                </Button>
              </section>

              <section className="relative overflow-hidden rounded-[1.5rem] bg-forward-50/70 p-4 shadow-sm ring-1 ring-forward-100/90">
                <h3 className="font-display text-base font-semibold text-forward-900">
                  Your MyMotiveLife photo
                </h3>
                <p className="mt-1 text-xs text-forward-500">
                  Family Map uses your MyMotiveLife profile photo. If you already set one in the
                  app or Settings, it shows here. If not, add it below — it updates your account
                  everywhere.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white"
                    style={{
                      background:
                        state.members.find((m) => m.isYou)?.color ?? "#00c6ff",
                    }}
                  >
                    {state.members.find((m) => m.isYou)?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={state.members.find((m) => m.isYou)!.avatarUrl!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (displayNameDraft || "?").slice(0, 1)
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {!state.members.find((m) => m.isYou)?.avatarUrl ? (
                      <p className="text-xs font-medium text-amber-800">
                        No profile photo yet — set one up so your family recognizes you on the map.
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-forward-600">
                        Using your MyMotiveLife profile photo.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => void onAvatarSelected(e.target.files?.[0] ?? null)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={avatarBusy || busy}
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {avatarBusy
                          ? "Uploading…"
                          : state.members.find((m) => m.isYou)?.avatarUrl
                            ? "Change photo"
                            : "Set up photo"}
                      </Button>
                      <a
                        href="/settings"
                        className={buttonClassName({
                          variant: "ghost",
                          className: "text-sm",
                        })}
                      >
                        Open Settings
                      </a>
                    </div>
                  </div>
                </div>
                <label className="mt-3 block text-xs font-medium text-forward-600">
                  Display name
                  <div className="mt-1 flex gap-2">
                    <input
                      value={displayNameDraft}
                      onChange={(e) => setDisplayNameDraft(e.target.value)}
                      className="flex-1 rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
                      placeholder="How you appear on the map"
                      maxLength={80}
                      disabled={busy}
                    />
                    <Button
                      type="button"
                      onClick={() => void saveDisplayName()}
                      disabled={
                        busy ||
                        !displayNameDraft.trim() ||
                        displayNameDraft.trim() ===
                          state.members.find((m) => m.isYou)?.displayName
                      }
                    >
                      Save
                    </Button>
                  </div>
                </label>
              </section>

              <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90">
                <h3 className="font-display text-base font-semibold text-forward-900">
                  Map display
                </h3>
                <p className="mt-0.5 text-xs text-forward-500">
                  Places stay saved for arrival alerts and ETA. These only change what you see
                  on the live map.
                </p>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-forward-500">
                  Place labels
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["off", "Hidden"],
                      ["ghost", "Faded"],
                      ["on", "Shown"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPlaceLabelsMode(mode);
                        writePlaceLabelsMode(mode);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        placeLabelsMode === mode
                          ? "bg-forward-900 text-white"
                          : "bg-forward-100 text-forward-700"
                      }`}
                      aria-pressed={placeLabelsMode === mode}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-forward-500">
                  Place zones
                </p>
                <p className="mt-1 text-xs text-forward-500">
                  Geofence rings around saved places on the map.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      [false, "Off"],
                      [true, "On"],
                    ] as const
                  ).map(([on, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setShowPlaceFences(on);
                        writePlaceFencesPreference(on);
                        if (!on) setVisitedPlaces([]);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        showPlaceFences === on
                          ? "bg-forward-900 text-white"
                          : "bg-forward-100 text-forward-700"
                      }`}
                      aria-pressed={showPlaceFences === on}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90">
                <h3 className="font-display text-base font-semibold text-forward-900">
                  Saved places
                </h3>
                <p className="mt-0.5 text-xs text-forward-500">
                  Tap a place on the map — or below — to edit name, icon, and geofence alerts.
                  Drop a pin on the map to add one.
                </p>
                {state.places.length > 0 ? (
                  <ul className="mt-3 divide-y divide-forward-100 rounded-xl border border-forward-100">
                    {state.places.map((place) => (
                      <li key={place.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-forward-50"
                          onClick={() => {
                            setShowTools(false);
                            selectPlace(place.id);
                          }}
                        >
                          <span className="min-w-0 truncate font-medium text-forward-900">
                            <span aria-hidden className="mr-1.5">
                              {CATEGORY_EMOJI[place.category] ?? "📍"}
                            </span>
                            {place.name}
                          </span>
                          <span className="shrink-0 text-xs text-forward-500">
                            {Math.round(place.radiusM)}m
                            {place.notifyOnEnter || place.notifyOnLeave ? " · alerts on" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-forward-500">
                    No places yet. Tap the map to drop a pin.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>,
        document.body
      )}

      {portalReady && placeDraft ? (
        <SavePinSheet
          draft={placeDraft}
          busy={busy}
          onClose={() => setPlaceDraft(null)}
          onSaved={(next) => {
            applyMapState(next);
            setPlaceDraft(null);
            setError(null);
          }}
          onError={setError}
        />
      ) : null}

      {portalReady && selectedPlaceId && placeEdit
        ? (() => {
            const place = state.places.find((p) => p.id === selectedPlaceId);
            if (!place) return null;
            return (
              <PlaceSettingsSheet
                place={place}
                draft={placeEdit}
                mode={placeSheetMode}
                busy={busy}
                onClose={clearPlaceUi}
                onModeChange={setPlaceSheetMode}
                onDraftChange={setPlaceEdit}
                onSaved={(next) => {
                  applyMapState(next);
                  setError(null);
                  // Keep draft in sync only while the sheet stays open (e.g. Back→menu).
                  // OK dismisses via onClose and clears place UI.
                  const updated = Array.isArray(next.places)
                    ? next.places.find((p) => p.id === selectedPlaceId)
                    : undefined;
                  if (updated) {
                    setPlaceEdit({
                      id: updated.id,
                      lat: updated.lat,
                      lng: updated.lng,
                      radiusM: Math.round(updated.radiusM),
                      shape: updated.shape === "square" ? "square" : "circle",
                    });
                  }
                }}
                onError={setError}
              />
            );
          })()
        : null}
    </div>
  );
}

type FriendsCircleState = {
  circles: Array<{
    id: string;
    name: string;
    type: string;
    inviteCode: string;
    memberCount: number;
    isOwner: boolean;
  }>;
  activeCircle: {
    id: string;
    name: string;
    type: string;
    inviteCode: string;
    memberCount: number;
    isOwner: boolean;
    members: Array<{
      id: string;
      displayName: string;
      sharingLevel: string;
      shareUntil: string | null;
      isYou: boolean;
      color: string;
      lat: number | null;
      lng: number | null;
      batteryPercent: number | null;
      lastLocationAt: string | null;
      statusLabel: string;
    }>;
  } | null;
};

function FriendsCirclePanel({
  friends,
  busy,
  joinCode,
  setJoinCode,
  onCreate,
  onJoin,
  onOpenFamilyMap,
}: {
  friends: FriendsCircleState | null;
  busy: boolean;
  joinCode: string;
  setJoinCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onOpenFamilyMap: () => void;
}) {
  const active = friends?.activeCircle;
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90">
      <h3 className="font-display text-base font-semibold text-forward-900">Friends circle</h3>
      <p className="mt-1 text-sm text-forward-600">
        Session share with buddies — tap pins on the map above. Not silent family tracking.
      </p>

      {active ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-forward-800">
            {active.name}
            {active.isOwner && active.inviteCode ? (
              <>
                {" · code "}
                <span className="font-mono font-semibold">{active.inviteCode}</span>
              </>
            ) : null}
          </p>
          <p className="text-xs text-forward-500">
            {active.members.filter((m) => m.lat != null).length}/{active.members.length} live on
            map
            {active.members.find((m) => m.isYou)?.shareUntil
              ? ` · your share until ${new Date(
                  active.members.find((m) => m.isYou)!.shareUntil!
                ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </p>
          <button
            type="button"
            onClick={onOpenFamilyMap}
            className={buttonClassName({ variant: "secondary", className: "w-full" })}
          >
            Back to family map
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <Button type="button" className="w-full" disabled={busy} onClick={onCreate}>
            Create friends circle
          </Button>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1 rounded-lg border border-forward-200 px-3 py-2 font-mono text-sm uppercase"
              placeholder="Friend invite code"
              maxLength={12}
            />
            <Button type="button" variant="secondary" disabled={busy || !joinCode} onClick={onJoin}>
              Join
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type FamilyAreaIntel,
  type FamilyMapMemberView,
  type FamilyMapState,
  type LocationSharingLevel,
} from "@forward/shared";
import { Expand, Minimize2, Settings2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/button";
import { LocationHistoryPanel } from "@/components/family/location-history-panel";
import { MemberIntelSheet } from "@/components/family/member-intel-sheet";
import { SavePinSheet, CATEGORY_EMOJI } from "@/components/family/save-pin-sheet";
import { PlaceSettingsSheet, type PlaceSheetMode } from "@/components/family/place-settings-sheet";
import type { EditableGeofenceDraft } from "@/components/family/editable-geofence";
import { FamilyIntelPanel } from "@/components/family/family-intel-panel";
import { FamilyMembersPanel } from "@/components/family/family-members-panel";
import { useFamilyLocationShare } from "@/hooks/use-family-location-share";
import { resizeImageFile } from "@/lib/avatar";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";
import {
  canUseNativeLocationBridge,
  describeNativeLocationPermission,
  getNativeLocationPermission,
  requestNativeLocationFix,
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
import { getNativeShellPlatform, isNativeShell } from "@/lib/native-shell";

function locationAgeMinutes(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - t) / 60_000);
}

function formatLocationAge(iso: string | null | undefined): string {
  const mins = locationAgeMinutes(iso);
  if (!Number.isFinite(mins)) return "No recent fix";
  if (mins < 1) return "Just now";
  if (mins < 60) return `Updated ${Math.round(mins)}m ago`;
  const hrs = Math.round(mins / 60);
  return `Updated ${hrs}h ago`;
}

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
  const [enablingLocation, setEnablingLocation] = useState(false);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleBusy, setVehicleBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showTools, setShowTools] = useState(false);
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
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [visitedPlaces, setVisitedPlaces] = useState<
    { name: string; lat: number; lng: number; radiusM: number }[]
  >([]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const refreshLocationDiag = useCallback(() => {
    if (!isNativeShell()) {
      setLocationDiag(null);
      return;
    }
    void describeNativeLocationPermission().then(setLocationDiag);
  }, []);

  useEffect(() => {
    refreshLocationDiag();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshLocationDiag();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshLocationDiag]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/family/map", { signal });
    if (!res.ok) {
      setError(await readError(res));
      return null;
    }
    const data = (await res.json()) as FamilyMapState;
    setState(data);
    setHouseholdNameDraft(data.household.name);
    const you = data.members.find((m) => m.isYou);
    if (you) setDisplayNameDraft(you.displayName);
    if (data.you.vehicle) {
      setVehicleMake(data.you.vehicle.make);
      setVehicleModel(data.you.vehicle.model);
      setVehicleYear(data.you.vehicle.year != null ? String(data.you.vehicle.year) : "");
    }
    setError(null);
    setSelectedId((prev) => prev ?? data.members[0]?.id ?? null);
    return data;
  }, []);

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
    const failSafe = window.setTimeout(() => controller.abort(), 8_000);

    (async () => {
      setLoading(true);
      try {
        const data = await refresh(controller.signal);
        if (cancelled) return;
        void refreshFriends();
        loadAreaIntel(data?.areaIntel?.center, () => cancelled);

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
      } catch (e) {
        if (!cancelled) {
          const aborted = e instanceof DOMException && e.name === "AbortError";
          setError(
            aborted
              ? "Map is taking too long on this connection. Tap Try again."
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
    const id = window.setInterval(() => {
      const controller = new AbortController();
      const failSafe = window.setTimeout(() => controller.abort(), 8_000);
      void refresh(controller.signal)
        .then((data) => {
          if (data?.areaIntel?.center) loadAreaIntel(data.areaIntel.center);
        })
        .finally(() => window.clearTimeout(failSafe));
      if (circleTab === "friends") void refreshFriends();
    }, followSelected ? 5_000 : 8_000);
    return () => window.clearInterval(id);
  }, [refresh, refreshFriends, circleTab, loadAreaIntel, followSelected]);

  useEffect(() => {
    if (!expanded && !showTools) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded, showTools]);

  const youMember = state?.members.find((m) => m.isYou) ?? null;
  const { sharing, error: shareError, lastFixAt, clearError } = useFamilyLocationShare({
    // Keep sharing even while the tools sheet is open
    enabled: shareLive && !!state,
    onState: setState,
    onDenied: () => {
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
    setEnablingLocation(true);
    setLocationHint(null);
    clearError();
    // Hard failsafe — WebView geolocation can hang forever without settling
    const failSafe = window.setTimeout(() => {
      setEnablingLocation(false);
      setShareLive(false);
      writeShareLivePreference(false);
      setLocationHint(
        getNativeShellPlatform() === "ios"
          ? 'GPS timed out. Settings → MotiveLife → Location must be While Using the App — “When I Share” is not enough. Then tap Enable location again.'
          : isNativeShell()
            ? "Location timed out. Open phone Settings → MotiveLife → Location → Allow, then try again."
            : "Location timed out. Check browser location permission and try again."
      );
    }, 60_000);
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

  function selectMember(id: string) {
    // Life360-style: tap focuses the map on them and follows live movement.
    // Open details from the chip “Details” control — not on every tap.
    setSelectedId(id);
    setFollowSelected(true);
    setSheetOpen(false);
    setShowTools(false);
    setPlaceDraft(null);
    clearPlaceUi();
  }

  function openMemberDetails(id: string) {
    setSelectedId(id);
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
        body: JSON.stringify({ code: joinCode }),
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
          timeoutMs: 18_000,
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
            const failSafe = window.setTimeout(() => controller.abort(), 8_000);
            void refresh(controller.signal)
              .catch((e) => {
                const aborted = e instanceof DOMException && e.name === "AbortError";
                setError(
                  aborted
                    ? "Map is taking too long on this connection. Tap Try again."
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
    <div
      ref={mapAnchorRef}
      className={
        expanded
          ? "fixed inset-0 z-[80] bg-white"
          : "relative z-0 h-[min(56vh,520px)] min-h-[320px] overflow-hidden rounded-2xl border border-forward-200 bg-[#e8eef5] sm:h-[min(64vh,640px)] sm:min-h-[360px]"
      }
    >
      <FamilyLeafletMap
        members={mapMembers}
        places={mapPlaces}
        selectedMemberId={selectedId}
        onSelectMember={selectMember}
        followSelected={followSelected && !selectedPlaceId}
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
        layoutKey={`tools:${showTools ? 1 : 0}|pin:${placeDraft ? 1 : 0}|place:${placeSheetMode}`}
        bottomPad={resizingPlace ? 120 : selectedPlaceId ? 220 : 120}
        routePath={historyTrip?.path ?? null}
        visitedPlaces={visitedPlaces}
      />

      {/* Top chrome on map — keep below app sheets (z < 100); hide while resizing geofence */}
      {!resizingPlace ? (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex rounded-full bg-white/95 p-1 shadow-md backdrop-blur">
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
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  circleTab === id
                    ? "bg-forward-900 text-white"
                    : "text-forward-600 hover:bg-forward-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto flex gap-2">
            {circleTab === "family" ? (
              <span className="hidden items-center rounded-full bg-white/90 px-2.5 text-[10px] font-medium text-forward-500 shadow-md sm:inline-flex">
                Tap map to name a place
              </span>
            ) : null}
            {circleTab === "family" ? (
              shareLive ? (
                <span className="inline-flex h-10 items-center rounded-full bg-white/95 px-3 text-xs font-semibold text-emerald-800 shadow-md">
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-forward-700 shadow-md"
              aria-label="Family settings"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-forward-700 shadow-md"
              aria-label={expanded ? "Exit full map" : "Expand map"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {circleTab === "family" ? (
          <div className="pointer-events-none max-w-[85%] self-start rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-forward-800 shadow-sm backdrop-blur">
            <span className="truncate">
              {state.flow.everyoneHomeByLabel ?? "Waiting for locations…"}
              {state.areaIntel?.weather ? ` · ${state.areaIntel.weather.tempC}°` : ""}
              {shareLive && sharing && lastFixAt
                ? ` · Live ${new Date(lastFixAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : ""}
            </span>
          </div>
        ) : null}
      </div>
      ) : null}

      {/* Member chips — hide while place sheet / geofence resize is open */}
      {!resizingPlace && !selectedPlaceId ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-3">
        {followSelected && selected && !sheetOpen && !selectedPlaceId ? (
          <div className="pointer-events-auto mb-2 flex items-center justify-between gap-2 rounded-2xl bg-forward-900/95 px-3 py-2 text-white shadow-lg">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                Following {selected.displayName}
                {selected.speedKmh != null &&
                (selected.presence === "driving" || selected.presence === "moving")
                  ? ` · ${Math.round(selected.speedKmh)} km/h`
                  : ""}
              </p>
              <p className="truncate text-[10px] text-white/70">
                {selected.statusLabel}
                {selected.lastLocationAt
                  ? ` · ${formatLocationAge(selected.lastLocationAt)}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"
                onClick={() => openMemberDetails(selected.id)}
              >
                Details
              </button>
              <button
                type="button"
                className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"
                onClick={() => setFollowSelected(false)}
              >
                Stop
              </button>
            </div>
          </div>
        ) : null}
        {!sheetOpen || !selected ? (
          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mapMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMember(m.id)}
                onDoubleClick={() => openMemberDetails(m.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border bg-white/95 px-3 py-2 text-left shadow-md backdrop-blur ${
                  selectedId === m.id ? "border-forward-900" : "border-forward-200"
                }`}
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                  style={{ background: m.color }}
                >
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    m.displayName.slice(0, 1)
                  )}
                </span>
                <span className="max-w-[9rem]">
                  <span className="block truncate text-xs font-semibold text-forward-900">
                    {m.displayName}
                  </span>
                  <span className="block truncate text-[10px] text-forward-500">
                    {m.lat == null || m.lng == null
                      ? m.isYou
                        ? shareLive
                          ? "Getting GPS…"
                          : "Allow location to appear"
                        : "Waiting for location…"
                      : m.speedKmh != null &&
                          (m.presence === "driving" || m.presence === "moving")
                        ? `${Math.round(m.speedKmh)} km/h · ${m.statusLabel}`
                        : m.lastLocationAt && locationAgeMinutes(m.lastLocationAt) >= 3
                          ? `${formatLocationAge(m.lastLocationAt)} · ${m.statusLabel}`
                          : m.relationshipLabel
                            ? m.relationshipLabel
                            : m.statusLabel}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
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
            setSheetOpen(false);
          }}
          onMemberUpdated={setState}
          historyRefreshKey={historyRefreshKey}
          selectedHistoryTripId={historyTrip?.id ?? null}
          onSelectHistoryTrip={setHistoryTrip}
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

      {/* Alerts / location help only — status + Share live live on the map */}
      {circleTab === "family" &&
      (state.flow.conflictNote ||
        state.somethingDifferent ||
        state.areaIntel?.alerts?.[0] ||
        locationHint ||
        shareError) ? (
        <div className="rounded-xl border border-forward-200 bg-white px-2.5 py-1.5">
          {state.flow.conflictNote ? (
            <p className="text-[11px] text-amber-800">{state.flow.conflictNote}</p>
          ) : null}
          {state.somethingDifferent ? (
            <p className="text-[11px] text-forward-800">
              <span className="font-semibold">{state.somethingDifferent.title}.</span>{" "}
              {state.somethingDifferent.body}
            </p>
          ) : null}
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
                <p className="mt-1 font-mono text-[10px] text-forward-500">{locationDiag}</p>
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
          <FamilyIntelPanel state={state} />
          {(selected ?? youMember) ? (
            <section className="rounded-2xl border border-forward-200 bg-white p-4">
              <LocationHistoryPanel
                memberId={(selected ?? youMember)!.id}
                memberName={(selected ?? youMember)!.displayName}
                isYou={(selected ?? youMember)!.isYou}
                refreshKey={historyRefreshKey}
                selectedTripId={historyTrip?.id ?? null}
                onSelectTrip={setHistoryTrip}
                onHighlightPlaces={setVisitedPlaces}
              />
              {historyTrip ? (
                <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-950">
                  Showing drive on the map: <strong>{historyTrip.fromLabel}</strong> →{" "}
                  <strong>{historyTrip.toLabel}</strong>
                  {historyTrip.estimatedFuelCostCad != null
                    ? ` · ~$${historyTrip.estimatedFuelCostCad.toFixed(2)} fuel`
                    : ""}
                  {" · "}
                  avg {historyTrip.avgSpeedKmh.toFixed(0)} km/h · max{" "}
                  {historyTrip.maxSpeedKmh.toFixed(0)} km/h · score {historyTrip.driveScore}. Tap
                  the drive again to clear the route.
                </p>
              ) : visitedPlaces.length > 0 ? (
                <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-950">
                  Historical areas visited ({visitedPlaces.length}):{" "}
                  {visitedPlaces.map((p) => p.name).join(", ")} — highlighted on the map.
                </p>
              ) : null}
            </section>
          ) : null}
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
                <section className="rounded-2xl border border-forward-200 bg-forward-50/50 p-4">
                  <h3 className="font-display text-base font-semibold text-forward-900">
                    Live location
                  </h3>
                  <p className="mt-1 text-xs text-forward-500">
                    Your family always sees your precise location while location is allowed on this
                    phone. Set MotiveLife to Always / Allow all the time for background updates.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {shareLive ? (
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

                <section className="rounded-2xl border border-forward-200 bg-forward-50/50 p-4">
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

              <section className="rounded-2xl border border-forward-200 bg-forward-50/50 p-4">
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

              <section className="rounded-2xl border border-forward-200 bg-forward-50/50 p-4">
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

              <section className="rounded-2xl border border-forward-200 bg-white p-4">
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
            setState(next);
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
                  setState(next);
                  setError(null);
                  const updated = next.places.find((p) => p.id === selectedPlaceId);
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
    <div className="rounded-2xl border border-forward-200 bg-white p-4">
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

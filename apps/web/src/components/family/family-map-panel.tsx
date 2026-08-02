"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LOCATION_SHARING_LABELS,
  LOCATION_SHARING_LEVELS,
  type FamilyAreaIntel,
  type FamilyMapMemberView,
  type FamilyMapState,
  type LocationSharingLevel,
} from "@forward/shared";
import { Expand, Minimize2, Settings2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/button";
import { LocationHistoryPanel } from "@/components/family/location-history-panel";
import { MemberIntelSheet } from "@/components/family/member-intel-sheet";
import { PlacesPanel } from "@/components/family/places-panel";
import { useFamilyLocationShare } from "@/hooks/use-family-location-share";
import { resizeImageFile } from "@/lib/avatar";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";
import {
  describeNativeLocationPermission,
  getNativeAppBuildLabel,
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
  const [householdNameDraft, setHouseholdNameDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [friends, setFriends] = useState<FriendsCircleState | null>(null);
  const [placeDraft, setPlaceDraft] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [showPlaces, setShowPlaces] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [historyTrip, setHistoryTrip] = useState<LocalHistoryTrip | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

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

        // Resume live sharing only if user opted in before AND OS still allows it
        if (readShareLivePreference()) {
          const granted = await hasLocationPermission();
          if (!cancelled && granted) {
            setShareLive(true);
            setLocationHint("Live location resumed.");
          } else if (!cancelled) {
            writeShareLivePreference(false);
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
    }, 15_000);
    return () => window.clearInterval(id);
  }, [refresh, refreshFriends, circleTab, loadAreaIntel]);

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
      setLocationHint(
        access.message ??
          (access.backgroundGranted
            ? "Always location on — your pin updates in the background."
            : "Location on — your pin will update live. Set Location to Always / Allow all the time for background sharing.")
      );
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

  function selectMember(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
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

  async function seedDemo() {
    setBusy(true);
    setError(null);
    try {
      const pos = await getPosition();
      const res = await fetch("/api/family/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
      setShareLive(true);
      setSheetOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sample household.");
    } finally {
      setBusy(false);
    }
  }

  async function clearDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/family/demo", { method: "DELETE" });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
      setSheetOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not exit sample household.");
    } finally {
      setBusy(false);
    }
  }

  const hasSampleMembers = !!state?.members.some((m) => m.isSimulated);

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
    } finally {
      setBusy(false);
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

  async function updatePrivacy(level: LocationSharingLevel) {
    setBusy(true);
    try {
      const res = await fetch("/api/family/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationSharingLevel: level }),
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

  const mapBlock = (
    <div
      className={
        expanded
          ? "fixed inset-0 z-[80] bg-white"
          : showTools
            ? "hidden"
            : "relative z-0 h-[min(56vh,520px)] min-h-[320px] overflow-hidden rounded-2xl border border-forward-200 bg-[#e8eef5] sm:h-[min(64vh,640px)] sm:min-h-[360px]"
      }
      aria-hidden={showTools && !expanded}
    >
      <FamilyLeafletMap
        members={mapMembers}
        places={mapPlaces}
        selectedMemberId={selectedId}
        onSelectMember={selectMember}
        expanded={expanded}
        bottomPad={sheetOpen && selected ? 280 : 120}
        routePath={historyTrip?.path ?? null}
      />

      {/* Top chrome on map — keep below app sheets (z < 100) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
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
          {circleTab === "family" && !shareLive ? (
            <button
              type="button"
              disabled={enablingLocation || busy}
              onClick={() => void enableLocationSharing()}
              className="inline-flex h-10 items-center rounded-full bg-forward-900 px-3 text-xs font-semibold text-white shadow-md"
            >
              {enablingLocation ? "Asking…" : "Enable location"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setShowTools(true);
              setShowPlaces(true);
              setSheetOpen(false);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-forward-700 shadow-md"
            aria-label="Sharing and places"
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

      {/* Member chips */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-3">
        {!sheetOpen || !selected ? (
          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mapMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMember(m.id)}
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
                  <span className="block truncate text-[10px] text-forward-500">{m.statusLabel}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {sheetOpen && selected ? (
        <MemberIntelSheet
          member={selected}
          state={state}
          onClose={() => {
            setSheetOpen(false);
            setHistoryTrip(null);
          }}
          historyRefreshKey={historyRefreshKey}
          selectedHistoryTripId={historyTrip?.id ?? null}
          onSelectHistoryTrip={setHistoryTrip}
          onSavePlaceAtMember={(m) => {
            if (m.lat == null || m.lng == null) return;
            setPlaceDraft({ lat: m.lat, lng: m.lng, label: m.displayName });
            setShowPlaces(true);
            setShowTools(true);
            setSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {/* Compact status — no spinners here */}
      <div className="rounded-2xl border border-forward-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
          {circleTab === "family" ? "Your family — now" : "Friends circle"}
        </p>
        <p className="mt-1 font-display text-lg font-semibold text-forward-900">
          {circleTab === "family"
            ? state.flow.everyoneHomeByLabel ?? "Waiting for live locations…"
            : friends?.activeCircle
              ? `${friends.activeCircle.name} · ${friends.activeCircle.memberCount} people`
              : "Create a friends circle to share presence"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-xs text-forward-500">
            {shareLive && sharing
              ? `Live sharing on${lastFixAt ? ` · ${new Date(lastFixAt).toLocaleTimeString()}` : ""}`
              : shareLive
                ? "Starting live location…"
                : "Live sharing off"}
          </p>
          {circleTab === "family" ? (
            shareLive ? (
              <button
                type="button"
                onClick={() => disableLocationSharing()}
                className="text-xs font-semibold text-forward-700 underline"
              >
                Turn off
              </button>
            ) : (
              <button
                type="button"
                disabled={enablingLocation || busy}
                onClick={() => void enableLocationSharing()}
                className="rounded-full bg-forward-900 px-2.5 py-1 text-xs font-semibold text-white"
              >
                {enablingLocation ? "Asking…" : "Turn on location"}
              </button>
            )
          ) : null}
        </div>
        {circleTab === "family" && state.flow.conflictNote ? (
          <p className="mt-2 text-sm text-amber-800">{state.flow.conflictNote}</p>
        ) : null}
        {circleTab === "family" && state.flow.opportunityNote ? (
          <p className="mt-1 text-sm text-forward-600">{state.flow.opportunityNote}</p>
        ) : null}
        {circleTab === "family" && state.somethingDifferent ? (
          <p className="mt-2 text-sm text-forward-800">
            <span className="font-semibold">{state.somethingDifferent.title}.</span>{" "}
            {state.somethingDifferent.body}
          </p>
        ) : null}
        {circleTab === "family" && state.areaIntel?.weather ? (
          <p className="mt-2 text-sm text-forward-700">
            <span className="font-semibold">
              {state.areaIntel.weather.summary} · {state.areaIntel.weather.tempC}°C
            </span>
            {" · "}
            {state.areaIntel.traffic.summary}
          </p>
        ) : null}
        {circleTab === "family" && state.areaIntel?.alerts?.[0] ? (
          <p
            className={`mt-1 text-sm ${
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
      </div>

      {/* Location enable — always visible when off; real OS permission on tap */}
      {circleTab === "family" && !expanded && !shareLive ? (
        <div className="rounded-2xl border-2 border-brand-blue/40 bg-brand-blue/5 px-4 py-4">
          <p className="font-display text-base font-semibold text-forward-900">
            Turn on live location
          </p>
          <p className="mt-1 text-sm text-forward-600">
            {getNativeShellPlatform() === "ios"
              ? 'Tap Enable location → Allow While Using App (never “When I Share” / Allow Once), then Always for background sharing. If Settings is stuck on When I Share: set Location → While Using or Always, then try again.'
              : "Tap Enable location → Allow Location, then set Allow all the time so MyMotiveFamily can share in the background (a persistent notification may appear)."}
          </p>
          {locationDiag ? (
            <p className="mt-2 rounded-lg bg-forward-900/5 px-2 py-1.5 font-mono text-[10px] leading-snug text-forward-600">
              {locationDiag}
            </p>
          ) : isNativeShell() && getNativeAppBuildLabel() ? (
            <p className="mt-1 text-[11px] text-forward-400">
              Native build {getNativeAppBuildLabel()}
            </p>
          ) : null}
          {(locationHint || shareError) && (
            <p className="mt-2 whitespace-pre-wrap text-xs font-medium text-amber-900">
              {locationHint || shareError}
            </p>
          )}
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={enablingLocation || busy}
            onClick={() => void enableLocationSharing()}
          >
            {enablingLocation ? "Asking for permission…" : "Enable location"}
          </Button>
          {isNativeShell() ? (
            <div className="mt-2 flex flex-col gap-1">
              <button
                type="button"
                className="w-full text-sm font-semibold text-brand-blue underline"
                onClick={() => {
                  if (!tryOpenAppSettings()) {
                    setLocationHint(
                      getNativeShellPlatform() === "ios"
                        ? "Open iPhone Settings → MotiveLife → Location → While Using the App."
                        : "Open phone Settings → Apps → MotiveLife → Permissions → Location → Allow."
                    );
                  }
                }}
              >
                Open app Permissions
              </button>
              {getNativeShellPlatform() === "android" ? (
                <button
                  type="button"
                  className="w-full text-sm font-semibold text-brand-blue underline"
                  onClick={() => {
                    if (!tryOpenLocationSettings()) {
                      setLocationHint(
                        "Open phone Settings → Location and turn Location on, then return here."
                      );
                    }
                  }}
                >
                  Open phone Location (GPS)
                </button>
              ) : null}
              <button
                type="button"
                className="w-full text-xs text-forward-500 underline"
                onClick={() => refreshLocationDiag()}
              >
                Refresh permission status
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {circleTab === "family" && !expanded && shareLive && (locationHint || shareError) ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {locationHint || shareError}
        </p>
      ) : null}

      {circleTab === "family" && !expanded && state.you.fuelSummary.tripCount > 0 ? (
        <div className="rounded-2xl border border-forward-200 bg-white px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
            Fuel this month
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-forward-900">
            ${state.you.fuelSummary.monthCad.toFixed(2)} CAD
            <span className="ml-2 text-sm font-normal text-forward-500">
              {state.you.fuelSummary.direction === "up"
                ? "↑ vs last month"
                : state.you.fuelSummary.direction === "down"
                  ? "↓ vs last month"
                  : "≈ last month"}
            </span>
          </p>
          {state.you.vehicle ? (
            <p className="mt-1 text-xs text-forward-500">
              {state.you.vehicle.make} {state.you.vehicle.model} · {state.you.vehicle.engineSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      {circleTab === "family" && !expanded ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setShowTools(true);
              setShowPlaces(true);
              setSheetOpen(false);
            }}
            className="rounded-xl border border-forward-200 bg-white px-3 py-3 text-sm font-semibold text-forward-900 shadow-sm"
          >
            Sharing & places
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTools(true);
              setShowPlaces(true);
              setSheetOpen(false);
            }}
            className="rounded-xl border border-forward-200 bg-white px-3 py-3 text-sm font-semibold text-forward-900 shadow-sm"
          >
            Invites & settings
          </button>
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

      {!expanded && circleTab === "family" && youMember ? (
        <section className="rounded-2xl border border-forward-200 bg-white p-4">
          <LocationHistoryPanel
            memberId={youMember.id}
            isYou
            refreshKey={historyRefreshKey}
            selectedTripId={historyTrip?.id ?? null}
            onSelectTrip={setHistoryTrip}
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
              {historyTrip.maxSpeedKmh.toFixed(0)} km/h · score {historyTrip.driveScore}. Tap the
              drive again to clear the route.
            </p>
          ) : null}
          {state.recentTrips.length > 0 ? (
            <div className="mt-4 border-t border-forward-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-forward-400">
                Recent household (shared)
              </h3>
              <ul className="mt-2 space-y-2">
                {state.recentTrips.slice(0, 3).map((trip, idx) => (
                  <li key={`${trip.fromLabel}-${idx}`} className="text-sm text-forward-700">
                    <span className="font-medium text-forward-900">
                      {trip.fromLabel} → {trip.toLabel}
                    </span>
                    {" · "}
                    {trip.distanceKm} km · Score {trip.driveScore}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasSampleMembers && !expanded ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Sample household is on</p>
          <p className="mt-0.5 text-xs">
            Sample members are preview-only. Exit anytime to use only your real family.
          </p>
          {state.household.isOwner ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              disabled={busy}
              onClick={() => void clearDemo()}
            >
              Exit sample household
            </Button>
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
            aria-label="Close sharing panel"
            onClick={() => {
              setShowTools(false);
              setShowPlaces(false);
            }}
          />
          <div className="relative z-10 flex max-h-[min(85vh,760px)] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-forward-100 px-4 py-3">
              <p className="font-display text-base font-semibold text-forward-900">
                Sharing, invites & places
              </p>
              <button
                type="button"
                className="rounded-full bg-forward-100 px-3 py-1.5 text-sm font-semibold text-forward-800"
                onClick={() => {
                  setShowTools(false);
                  setShowPlaces(false);
                }}
              >
                Done
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto overscroll-contain p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {hasSampleMembers && state.household.isOwner ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  <p className="font-semibold">Stuck in the sample family?</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void clearDemo()}
                    className="mt-1 text-sm font-semibold underline"
                  >
                    Exit sample household
                  </button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-2xl border border-forward-200 bg-forward-50/50 p-4">
                  <h3 className="font-display text-base font-semibold text-forward-900">
                    Live location
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      disabled={enablingLocation || busy}
                      onClick={() => {
                        if (shareLive) {
                          disableLocationSharing();
                          return;
                        }
                        void enableLocationSharing();
                      }}
                    >
                      {enablingLocation
                        ? "Asking…"
                        : shareLive
                          ? "Turn location off"
                          : "Enable location"}
                    </Button>
                    <span className="text-xs text-forward-500">
                      {shareLive
                        ? sharing
                          ? `Live${lastFixAt ? ` · ${new Date(lastFixAt).toLocaleTimeString()}` : ""}`
                          : "Starting…"
                        : "Off"}
                    </span>
                  </div>
                  {(locationHint || shareError) && (
                    <p className="mt-2 text-xs text-amber-800">{locationHint || shareError}</p>
                  )}
                  <label className="mt-3 block text-xs font-medium text-forward-600">
                    Sharing level
                    <select
                      className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-3 py-2 text-sm"
                      value={state.you.locationSharingLevel}
                      onChange={(e) => updatePrivacy(e.target.value as LocationSharingLevel)}
                      disabled={busy}
                    >
                      {LOCATION_SHARING_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {LOCATION_SHARING_LABELS[level]}
                        </option>
                      ))}
                    </select>
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
                    <p className="mt-3 text-sm text-forward-600">
                      Invite code{" "}
                      <span className="font-mono font-semibold text-forward-900">
                        {state.household.inviteCode}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-forward-600">
                      Ask the owner for an invite code to join.
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
                  {state.household.isOwner ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void seedDemo()}
                      className={buttonClassName({
                        variant: "secondary",
                        className: "mt-3 w-full",
                      })}
                    >
                      Preview sample household
                    </button>
                  ) : null}
                </section>
              </div>

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

              <PlacesPanel
                places={state.places}
                busy={busy}
                draftFromMember={placeDraft}
                onClearDraft={() => setPlaceDraft(null)}
                onSaved={(next) => {
                  setState(next);
                  setError(null);
                }}
                onError={setError}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
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

function getPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
    });
  });
}

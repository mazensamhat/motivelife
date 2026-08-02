"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MemberIntelSheet } from "@/components/family/member-intel-sheet";
import { PlacesPanel } from "@/components/family/places-panel";
import { useFamilyLocationShare } from "@/hooks/use-family-location-share";

const FamilyLeafletMap = dynamic(() => import("@/components/family/family-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#e8eef5] text-sm text-forward-500">
      Loading map…
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
  // Opt-in — auto-requesting GPS on Fold was denying + looking like a stuck spinner
  const [shareLive, setShareLive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [circleTab, setCircleTab] = useState<CircleTab>("family");
  const [joinCode, setJoinCode] = useState("");
  const [friends, setFriends] = useState<FriendsCircleState | null>(null);
  const [placeDraft, setPlaceDraft] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [showPlaces, setShowPlaces] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/family/map", { signal });
    if (!res.ok) {
      setError(await readError(res));
      return null;
    }
    const data = (await res.json()) as FamilyMapState;
    setState(data);
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
        // Weather is optional — fill in after map paints
        const center = data?.areaIntel?.center;
        if (center) {
          void fetch(
            `/api/family/area-intel?lat=${center.lat}&lng=${center.lng}`
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((body: { areaIntel?: FamilyAreaIntel } | null) => {
              if (!body?.areaIntel || cancelled) return;
              setState((prev) =>
                prev ? { ...prev, areaIntel: body.areaIntel! } : prev
              );
            })
            .catch(() => undefined);
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
  }, [refresh, refreshFriends]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
      if (circleTab === "friends") void refreshFriends();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [refresh, refreshFriends, circleTab]);

  useEffect(() => {
    if (!expanded && !showTools) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded, showTools]);

  const { sharing, error: shareError, lastFixAt } = useFamilyLocationShare({
    enabled: shareLive && !!state && !showTools,
    onState: setState,
    onDenied: () => setShareLive(false),
  });

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
            void refresh().finally(() => setLoading(false));
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
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: m.color }}
                >
                  {m.displayName.slice(0, 1)}
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
          onClose={() => setSheetOpen(false)}
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
      {(error || shareError) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>{error || shareError}</p>
          {shareError && !shareLive ? (
            <p className="mt-1 text-xs">
              You can still use the map, Sharing & places, and sample household without live GPS.
            </p>
          ) : null}
        </div>
      )}

      {/* Compact status */}
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

      {/* Always-visible shortcuts — Z Fold / phones couldn't reach buried tools */}
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
              if (!shareLive) {
                setShareLive(true);
                return;
              }
              setShowTools(true);
              setShowPlaces(true);
              setSheetOpen(false);
            }}
            className="rounded-xl border border-forward-200 bg-white px-3 py-3 text-sm font-semibold text-forward-900 shadow-sm"
          >
            {shareLive ? "Invites & settings" : "Share my location"}
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

      {!expanded && circleTab === "family" && state.recentTrips.length > 0 ? (
        <section className="rounded-2xl border border-forward-200 bg-white p-4">
          <h3 className="font-display text-base font-semibold text-forward-900">Drive Score</h3>
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
        </section>
      ) : null}

      {hasSampleMembers && !expanded ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Sample household is on</p>
          <p className="mt-0.5 text-xs">
            Mom / Mohamad / Mahdi are preview people. Exit anytime to use only your real family.
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
                  <label className="mt-3 flex items-center gap-2 text-sm text-forward-800">
                    <input
                      type="checkbox"
                      checked={shareLive}
                      onChange={(e) => setShareLive(e.target.checked)}
                    />
                    Share my location
                  </label>
                  <p className="mt-1 text-xs text-forward-500">
                    {shareLive
                      ? sharing
                        ? `Active${lastFixAt ? ` · ${new Date(lastFixAt).toLocaleTimeString()}` : ""}`
                        : "Waiting for GPS permission…"
                      : "Off — turn on to share your live pin"}
                  </p>
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
                  {state.household.isOwner && state.household.inviteCode ? (
                    <p className="mt-2 text-sm text-forward-600">
                      Invite code{" "}
                      <span className="font-mono font-semibold text-forward-900">
                        {state.household.inviteCode}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-forward-600">
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

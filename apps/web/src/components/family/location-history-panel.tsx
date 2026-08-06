"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DriveTripSummary,
  FamilyHistoryItem,
  FamilyPlaceVisitView,
} from "@forward/shared";
import {
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MapPin,
  Trash2,
  X,
} from "lucide-react";
import {
  clearLocalHistory,
  deleteLocalTrip,
  listLocalTrips,
} from "@/lib/family-map/local-history-store";
import { filterAndSortTrips } from "@/lib/family-map/local-trip-engine";
import type {
  LocalHistoryPathPoint,
  LocalHistoryRange,
  LocalHistoryTrip,
} from "@/lib/family-map/local-history-types";
import { TripRouteThumb } from "@/components/family/trip-route-thumb";
import { DriveEventsStrip } from "@/components/family/drive-events-strip";
import { DriveScoreBubble } from "@/components/family/drive-score-bubble";
import { fetchRouteForDriveTrip } from "@/lib/family-map/fetch-trip-route";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function hasCoords(lat?: number | null, lng?: number | null) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

function cloudToLocal(trip: DriveTripSummary, path: LocalHistoryPathPoint[]): LocalHistoryTrip {
  const startLat = hasCoords(trip.startLat, trip.startLng)
    ? trip.startLat!
    : path[0]?.lat ?? 0;
  const startLng = hasCoords(trip.startLat, trip.startLng)
    ? trip.startLng!
    : path[0]?.lng ?? 0;
  const endLat = hasCoords(trip.endLat, trip.endLng)
    ? trip.endLat!
    : path[path.length - 1]?.lat ?? 0;
  const endLng = hasCoords(trip.endLat, trip.endLng)
    ? trip.endLng!
    : path[path.length - 1]?.lng ?? 0;
  return {
    id: trip.id ?? `cloud-${trip.fromLabel}-${trip.toLabel}-${trip.startedAt ?? ""}`,
    memberId: trip.memberId ?? "",
    fromLabel: trip.fromLabel,
    toLabel: trip.toLabel,
    startLat,
    startLng,
    endLat,
    endLng,
    path,
    distanceKm: trip.distanceKm,
    durationMinutes: trip.durationMinutes,
    avgSpeedKmh: trip.avgSpeedKmh,
    maxSpeedKmh: trip.maxSpeedKmh,
    estimatedFuelLitres: trip.estimatedFuelLitres ?? null,
    estimatedFuelKwh: trip.estimatedFuelKwh ?? null,
    estimatedFuelCostCad: trip.estimatedFuelCostCad ?? null,
    driveScore: trip.driveScore,
    hardBraking: trip.hardBraking,
    rapidAcceleration: trip.rapidAcceleration,
    unusualRouteEvents: trip.unusualRouteEvents,
    startedAt: trip.startedAt ?? new Date().toISOString(),
    endedAt: trip.endedAt ?? new Date().toISOString(),
  };
}

function fallbackPath(trip: DriveTripSummary): LocalHistoryPathPoint[] {
  if (!hasCoords(trip.startLat, trip.startLng) || !hasCoords(trip.endLat, trip.endLng)) {
    return [];
  }
  return [
    {
      lat: trip.startLat!,
      lng: trip.startLng!,
      t: trip.startedAt ?? new Date().toISOString(),
      speedKmh: null,
    },
    {
      lat: trip.endLat!,
      lng: trip.endLng!,
      t: trip.endedAt ?? new Date().toISOString(),
      speedKmh: null,
    },
  ];
}

/**
 * Compact Life360-style history under the map.
 * When a drive is on the map, collapses so the map stays full-height.
 */
export type DriveHistoryPager = {
  index: number;
  total: number;
  label: string;
  whenLabel: string;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
};

/** Optional hint so pager can match cloud vs local trip ids after remount. */
export type SelectedDriveHint = {
  fromLabel: string;
  toLabel: string;
  startedAt: string;
  distanceKm: number;
};

function labelsClose(a: string, b: string) {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export function LocationHistoryPanel({
  memberId,
  memberName,
  isYou,
  refreshKey = 0,
  selectedTripId,
  selectedTripHint = null,
  onSelectTrip,
  onHighlightPlaces,
  /** When true, keep list collapsed while a route is shown on the map. */
  mapFirst = true,
  /** Optional map-chrome pager (side arrows) while a drive owns the map. */
  onDrivePagerChange,
}: {
  memberId: string;
  memberName?: string;
  isYou: boolean;
  refreshKey?: number;
  selectedTripId: string | null;
  selectedTripHint?: SelectedDriveHint | null;
  onSelectTrip: (trip: LocalHistoryTrip | null) => void;
  onHighlightPlaces?: (
    places: { name: string; lat: number; lng: number; radiusM: number }[]
  ) => void;
  mapFirst?: boolean;
  onDrivePagerChange?: (pager: DriveHistoryPager | null) => void;
}) {
  const [range, setRange] = useState<LocalHistoryRange>("month");
  const [items, setItems] = useState<FamilyHistoryItem[]>([]);
  const [localTrips, setLocalTrips] = useState<LocalHistoryTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [selectedPath, setSelectedPath] = useState<LocalHistoryPathPoint[] | null>(null);
  const memberIdRef = useRef(memberId);
  const selectGenRef = useRef(0);
  const autoWidenRef = useRef(false);

  useEffect(() => {
    memberIdRef.current = memberId;
    autoWidenRef.current = false;
    setItems([]);
    setLoading(true);
  }, [memberId]);

  const loadCloud = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const tz = new Date().getTimezoneOffset();
        const res = await fetch(
          `/api/family/history?memberId=${encodeURIComponent(memberId)}&range=${range}&tzOffsetMinutes=${tz}`,
          { signal }
        );
        if (signal?.aborted) return;
        if (!res.ok) {
          setError("Could not load history.");
          return;
        }
        const data = (await res.json()) as {
          items: FamilyHistoryItem[];
        };
        if (signal?.aborted || memberIdRef.current !== memberId) return;
        const next = data.items ?? [];
        setItems(next);
        setError(null);
        // Empty "Today" is often a timezone/calendar miss — widen once to Month.
        if (
          range === "day" &&
          next.length === 0 &&
          !autoWidenRef.current
        ) {
          autoWidenRef.current = true;
          setRange("month");
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (memberIdRef.current !== memberId) return;
        setError("Could not load history.");
      } finally {
        if (!signal?.aborted && memberIdRef.current === memberId) {
          setLoading(false);
        }
      }
    },
    [memberId, range]
  );

  const loadLocal = useCallback(async () => {
    if (!isYou) {
      setLocalTrips([]);
      return;
    }
    try {
      const rows = await listLocalTrips(memberId);
      if (memberIdRef.current !== memberId) return;
      setLocalTrips(rows);
    } catch {
      // optional
    }
  }, [isYou, memberId]);

  useEffect(() => {
    // Keep prior rows while refreshing so history doesn't flash "empty".
    setError(null);
    setSelectedPath(null);
    setExpandedId(null);
    selectGenRef.current += 1;
    const ac = new AbortController();
    void loadCloud(ac.signal);
    void loadLocal();
    return () => ac.abort();
  }, [loadCloud, loadLocal, refreshKey]);

  useEffect(() => {
    return () => {
      onHighlightPlaces?.([]);
    };
  }, [onHighlightPlaces]);

  // Keep the map dominant whenever a route is selected.
  useEffect(() => {
    if (mapFirst && selectedTripId) setListOpen(false);
  }, [mapFirst, selectedTripId]);

  const localByKey = useMemo(() => {
    const map = new Map<string, LocalHistoryTrip>();
    for (const t of filterAndSortTrips(localTrips, range, "newest")) {
      map.set(`${t.fromLabel}|${t.toLabel}|${Math.round(t.distanceKm * 10)}`, t);
    }
    return map;
  }, [localTrips, range]);

  const totals = useMemo(() => {
    const drives = items.filter((i) => i.kind === "drive");
    const stays = items.filter((i) => i.kind === "stay");
    const km = drives.reduce((a, i) => a + (i.kind === "drive" ? i.trip.distanceKm : 0), 0);
    const cost = drives.reduce(
      (a, i) => a + (i.kind === "drive" ? i.trip.estimatedFuelCostCad ?? 0 : 0),
      0
    );
    return {
      drives: drives.length,
      stays: stays.length,
      km: Number(km.toFixed(1)),
      cost: Number(cost.toFixed(2)),
    };
  }, [items]);

  /** Newest-first drives in the active range — used for prev/next paging. */
  const driveItems = useMemo(
    () => items.filter((i): i is Extract<FamilyHistoryItem, { kind: "drive" }> => i.kind === "drive"),
    [items]
  );

  const selectedDriveIndex = useMemo(() => {
    if (!selectedTripId && !selectedTripHint) return -1;

    // 1) Exact id match (cloud id, local id, or cloud- key).
    if (selectedTripId) {
      const byId = driveItems.findIndex((item) => {
        const key = `${item.trip.fromLabel}|${item.trip.toLabel}|${Math.round(item.trip.distanceKm * 10)}`;
        const local = localByKey.get(key);
        const ids = [
          item.trip.id,
          local?.id,
          `cloud-${item.trip.fromLabel}-${item.trip.toLabel}-${item.trip.startedAt ?? ""}`,
        ].filter(Boolean) as string[];
        return ids.includes(selectedTripId);
      });
      if (byId >= 0) return byId;
    }

    // 2) Fuzzy match — sheet/local ids often differ from cloud trip ids after remount.
    const hint = selectedTripHint;
    if (!hint) return -1;
    const hintMs = Date.parse(hint.startedAt);
    let best = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < driveItems.length; i++) {
      const t = driveItems[i]!.trip;
      const tMs = Date.parse(t.startedAt ?? t.endedAt ?? "");
      if (!Number.isFinite(tMs) || !Number.isFinite(hintMs)) continue;
      const delta = Math.abs(tMs - hintMs);
      const labelOk =
        labelsClose(t.fromLabel, hint.fromLabel) ||
        labelsClose(t.toLabel, hint.toLabel);
      const distOk = Math.abs(t.distanceKm - hint.distanceKm) <= Math.max(1.5, hint.distanceKm * 0.35);
      if (delta <= 3 * 60_000 && (labelOk || distOk) && delta < bestDelta) {
        best = i;
        bestDelta = delta;
      }
    }
    if (best >= 0) return best;

    // 3) Last resort: closest start time within 15 minutes so arrows still work.
    for (let i = 0; i < driveItems.length; i++) {
      const t = driveItems[i]!.trip;
      const tMs = Date.parse(t.startedAt ?? t.endedAt ?? "");
      if (!Number.isFinite(tMs) || !Number.isFinite(hintMs)) continue;
      const delta = Math.abs(tMs - hintMs);
      if (delta <= 15 * 60_000 && delta < bestDelta) {
        best = i;
        bestDelta = delta;
      }
    }
    return best;
  }, [driveItems, localByKey, selectedTripId, selectedTripHint]);

  const selectedSummary = useMemo(() => {
    if (selectedDriveIndex >= 0) return driveItems[selectedDriveIndex]?.trip ?? null;
    // Keep strip/map chrome useful even before the list rematches.
    if (selectedTripHint && selectedTripId) {
      return {
        fromLabel: selectedTripHint.fromLabel,
        toLabel: selectedTripHint.toLabel,
        startedAt: selectedTripHint.startedAt,
        endedAt: selectedTripHint.startedAt,
        distanceKm: selectedTripHint.distanceKm,
        durationMinutes: 0,
        driveScore: 0,
        maxSpeedKmh: 0,
        hardBraking: 0,
        rapidAcceleration: 0,
        unusualRouteEvents: 0,
      } as DriveTripSummary;
    }
    return null;
  }, [driveItems, selectedDriveIndex, selectedTripHint, selectedTripId]);

  async function selectDrive(trip: DriveTripSummary, opts?: { force?: boolean }) {
    const forMember = memberId;
    const gen = ++selectGenRef.current;
    const stillMine = () =>
      selectGenRef.current === gen && memberIdRef.current === forMember;

    const key = `${trip.fromLabel}|${trip.toLabel}|${Math.round(trip.distanceKm * 10)}`;
    const local = localByKey.get(key);
    const selectedIds = new Set(
      [trip.id, local?.id, `cloud-${trip.fromLabel}-${trip.toLabel}-${trip.startedAt ?? ""}`].filter(
        Boolean
      ) as string[]
    );
    // List tap toggles off; pager arrows always move to the target drive.
    if (!opts?.force && selectedTripId && selectedIds.has(selectedTripId)) {
      onSelectTrip(null);
      setSelectedPath(null);
      setListOpen(true);
      return;
    }

    if (local && local.path.length >= 2) {
      // Prefer local crumbs; heal moderate BG gaps without inventing a new route.
      setBusy(true);
      try {
        const { enrichPathWithRoadRoute } = await import(
          "@/lib/family-map/road-route"
        );
        const routed = await enrichPathWithRoadRoute(local.path, {
          force: local.path.length <= 2,
        });
        if (!stillMine()) return;
        const path =
          routed.length >= 2
            ? routed.map((p) => ({
                lat: p.lat,
                lng: p.lng,
                t: p.t ?? new Date().toISOString(),
                speedKmh: p.speedKmh ?? null,
              }))
            : local.path;
        setSelectedPath(path);
        onSelectTrip({ ...local, memberId: forMember, path });
      } finally {
        if (stillMine()) setBusy(false);
      }
      return;
    }

    let path: LocalHistoryPathPoint[] = [];
    if (trip.id) {
      setBusy(true);
      try {
        path = await fetchRouteForDriveTrip(trip, forMember);
      } catch {
        // fall through to A→B
      } finally {
        if (stillMine()) setBusy(false);
      }
    }
    if (!stillMine()) return;

    // Prefer a real breadcrumb path. Only use start→end when we truly have nothing.
    if (path.length < 2 && local && local.path.length >= 2) {
      path = local.path;
    }
    if (path.length < 2) path = fallbackPath(trip);
    if (path.length < 2) {
      setError("No route points for that drive yet.");
      return;
    }

    // Prefer GPS; splice moderate long chords only (no full-path invent).
    try {
      const { enrichPathWithRoadRoute } = await import(
        "@/lib/family-map/road-route"
      );
      const routed = await enrichPathWithRoadRoute(path, {
        force: path.length <= 2,
      });
      if (!stillMine()) return;
      if (routed.length >= 2) {
        path = routed.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          t: p.t ?? new Date().toISOString(),
          speedKmh: p.speedKmh ?? null,
        }));
      }
    } catch {
      // keep path
    }

    if (!stillMine()) return;
    setSelectedPath(path);
    onSelectTrip({ ...cloudToLocal(trip, path), memberId: forMember });
  }

  const driveNavRef = useRef({
    index: -1,
    trips: [] as DriveTripSummary[],
    select: (_trip: DriveTripSummary) => {},
  });
  // When the open route isn't matched yet, still allow paging from the list head.
  const navIndex =
    selectedDriveIndex >= 0 ? selectedDriveIndex : selectedTripId && driveItems.length > 0 ? 0 : -1;
  driveNavRef.current = {
    index: navIndex,
    trips: driveItems.map((d) => d.trip),
    select: (trip: DriveTripSummary) => {
      void selectDrive(trip, { force: true });
    },
  };

  const goPrevDrive = useCallback(() => {
    // Newest-first list: previous = newer drive (lower index).
    const { index, trips, select } = driveNavRef.current;
    if (index <= 0) return;
    const trip = trips[index - 1];
    if (trip) select(trip);
  }, []);

  const goNextDrive = useCallback(() => {
    // Next = older drive (higher index) — step back through time.
    const { index, trips, select } = driveNavRef.current;
    if (index < 0 || index >= trips.length - 1) return;
    const trip = trips[index + 1];
    if (trip) select(trip);
  }, []);

  useEffect(() => {
    if (!onDrivePagerChange) return;
    // Arm pager whenever a route is on the map and we have (or will have) drives.
    if (!selectedTripId) {
      onDrivePagerChange(null);
      return;
    }
    const index = navIndex >= 0 ? navIndex : 0;
    const total = Math.max(driveItems.length, 1);
    const summary = selectedSummary;
    onDrivePagerChange({
      index,
      total,
      label: summary
        ? `${summary.fromLabel} → ${summary.toLabel}`
        : "Drive on map",
      whenLabel: summary
        ? formatWhen(summary.startedAt ?? summary.endedAt ?? new Date().toISOString())
        : "Stepping through history",
      canPrev: driveItems.length > 1 && index > 0,
      canNext: driveItems.length > 1 && index < driveItems.length - 1,
      goPrev: goPrevDrive,
      goNext: goNextDrive,
    });
    return () => onDrivePagerChange(null);
  }, [
    onDrivePagerChange,
    selectedTripId,
    navIndex,
    selectedSummary,
    driveItems.length,
    goPrevDrive,
    goNextDrive,
  ]);

  async function clearCloudHistory() {
    if (
      !window.confirm(
        "Clear your cloud location history? This removes drives, stays, and GPS breadcrumbs from the server. (Finished history is also auto-removed after 90 days free / 12 months with MyMotiveFamily; GPS route dots after ~35 days.)"
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/family/history?memberId=${encodeURIComponent(memberId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not clear cloud history.");
        return;
      }
      if (isYou) {
        await clearLocalHistory(memberId);
        await loadLocal();
      }
      onSelectTrip(null);
      setSelectedPath(null);
      setItems([]);
      await loadCloud();
    } finally {
      setBusy(false);
    }
  }

  // Collapsed strip while a route owns the map
  if (mapFirst && selectedTripId && !listOpen) {
    const index = navIndex >= 0 ? navIndex : 0;
    const canPrev = driveItems.length > 1 && index > 0;
    const canNext = driveItems.length > 1 && index < driveItems.length - 1;
    return (
      <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev || busy}
            aria-label="Newer drive"
            title="Newer drive"
            onClick={goPrevDrive}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sky-900 shadow-md ring-1 ring-sky-200 disabled:opacity-35"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Car className="h-4 w-4 shrink-0 text-sky-800" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sky-950">
              {selectedSummary
                ? `${selectedSummary.fromLabel} → ${selectedSummary.toLabel}`
                : "Drive on map"}
            </p>
            <p className="truncate text-[10px] text-sky-900/70">
              {selectedSummary
                ? `${formatWhen(selectedSummary.startedAt ?? selectedSummary.endedAt ?? new Date().toISOString())} · ${selectedSummary.distanceKm.toFixed(1)} km`
                : "Use arrows to step through drives by time"}
              {driveItems.length > 0
                ? ` · ${Math.min(index + 1, driveItems.length)}/${driveItems.length}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={!canNext || busy}
            aria-label="Older drive"
            title="Older drive"
            onClick={goNextDrive}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sky-900 shadow-md ring-1 ring-sky-200 disabled:opacity-35"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-forward-800 shadow-sm"
            onClick={() => setListOpen(true)}
          >
            List
          </button>
          <button
            type="button"
            className="rounded-full bg-white p-1.5 text-forward-700 shadow-sm"
            aria-label="Clear route"
            onClick={() => {
              onSelectTrip(null);
              setSelectedPath(null);
              setListOpen(true);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {selectedSummary && selectedDriveIndex >= 0 ? (
          <DriveEventsStrip
            maxSpeedKmh={selectedSummary.maxSpeedKmh}
            hardBraking={selectedSummary.hardBraking}
            rapidAcceleration={selectedSummary.rapidAcceleration}
            unusualRouteEvents={selectedSummary.unusualRouteEvents}
            compact
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-forward-900">
            Location history
            {memberName && !isYou ? (
              <span className="font-normal text-forward-500"> · {memberName}</span>
            ) : null}
          </p>
          <p className="text-[11px] text-forward-500">
            {totals.drives} drives · {totals.stays} stays · {totals.km} km
            {totals.cost > 0 ? ` · ~$${totals.cost.toFixed(2)}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-forward-100 px-2.5 py-1 text-[11px] font-semibold text-forward-700"
          onClick={() => setListOpen((v) => !v)}
        >
          {listOpen ? (
            <>
              Hide <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {!listOpen ? null : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["day", "Today"],
                ["month", "Month"],
                ["year", "Year"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  range === value
                    ? "bg-forward-900 text-white"
                    : "bg-forward-100 text-forward-700 hover:bg-forward-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {error ? <p className="text-xs text-amber-800">{error}</p> : null}

          {loading && items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-forward-200 bg-white px-3 py-3 text-xs text-forward-500">
              Loading history…
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-forward-200 bg-white px-3 py-3 text-xs text-forward-500">
              No history in this range yet. Try Month or All, and keep Share live on.
            </p>
          ) : (
            <ul className="max-h-[min(22vh,180px)] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
              {items.map((item) => {
                if (item.kind === "stay") {
                  const v = item.visit;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-forward-200 bg-white px-2.5 py-2 text-left hover:border-forward-300"
                        onClick={() => {
                          if (v.placeLat != null && v.placeLng != null) {
                            onHighlightPlaces?.([
                              {
                                name: v.placeName,
                                lat: v.placeLat,
                                lng: v.placeLng,
                                radiusM: v.placeRadiusM ?? 100,
                              },
                            ]);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                            <MapPin className="h-3 w-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-forward-900">
                              At {v.placeName}
                              {v.isActive ? (
                                <span className="ml-1 text-[10px] font-medium text-brand-blue">
                                  · now
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-[10px] text-forward-500">
                              {v.isActive
                                ? `Arrived ${formatClock(v.arrivedAt)} · ${v.dwellMinutes} min`
                                : `${formatClock(v.arrivedAt)} – ${
                                    v.departedAt ? formatClock(v.departedAt) : "?"
                                  } · ${v.dwellMinutes} min`}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                }

                const trip = item.trip;
                const selected =
                  selectedTripId === trip.id ||
                  selectedTripId ===
                    localByKey.get(
                      `${trip.fromLabel}|${trip.toLabel}|${Math.round(trip.distanceKm * 10)}`
                    )?.id;
                const open = expandedId === item.id;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setExpandedId(open ? null : item.id);
                        void selectDrive(trip);
                      }}
                      className={`w-full rounded-2xl px-2.5 py-2 text-left transition ring-1 ${
                        selected
                          ? "bg-sky-50 ring-sky-300"
                          : "bg-white ring-forward-100 hover:bg-forward-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forward-900 text-white shadow-sm">
                          <Car className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-forward-900">
                              {trip.fromLabel} → {trip.toLabel}
                            </p>
                            <p className="shrink-0 text-[10px] font-medium text-forward-700">
                              {trip.distanceKm.toFixed(1)} km
                            </p>
                          </div>
                          <p className="truncate text-[10px] text-forward-500">
                            {trip.startedAt ? formatWhen(trip.startedAt) : formatWhen(item.at)}
                            {" · "}
                            {trip.durationMinutes} min · max {trip.maxSpeedKmh}
                            {selected ? " · on map" : ""}
                          </p>
                        </div>
                        <DriveScoreBubble
                          score={trip.driveScore}
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    </button>

                    {selected ? (
                      <div className="mt-1 space-y-1.5 rounded-xl bg-forward-50 px-2.5 py-2 text-[11px] text-forward-700">
                        <DriveEventsStrip
                          maxSpeedKmh={trip.maxSpeedKmh}
                          hardBraking={trip.hardBraking}
                          rapidAcceleration={trip.rapidAcceleration}
                          unusualRouteEvents={trip.unusualRouteEvents}
                          compact
                        />
                        <TripRouteThumb
                          path={selectedPath}
                          start={
                            hasCoords(trip.startLat, trip.startLng)
                              ? { lat: trip.startLat!, lng: trip.startLng! }
                              : null
                          }
                          end={
                            hasCoords(trip.endLat, trip.endLng)
                              ? { lat: trip.endLat!, lng: trip.endLng! }
                              : null
                          }
                          className="h-14"
                        />
                        <p>
                          Hard brakes {trip.hardBraking} · Rapid accel {trip.rapidAcceleration} ·
                          Unusual {trip.unusualRouteEvents}
                        </p>
                        {isYou &&
                        localByKey.has(
                          `${trip.fromLabel}|${trip.toLabel}|${Math.round(trip.distanceKm * 10)}`
                        ) ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600"
                            disabled={busy}
                            onClick={async () => {
                              const local = localByKey.get(
                                `${trip.fromLabel}|${trip.toLabel}|${Math.round(trip.distanceKm * 10)}`
                              );
                              if (!local) return;
                              setBusy(true);
                              try {
                                await deleteLocalTrip(local.id);
                                onSelectTrip(null);
                                await loadLocal();
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete on-device copy
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {isYou ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {localTrips.length > 0 ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-forward-500 underline"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm("Clear on-device drive history on this phone?")) return;
                    await clearLocalHistory(memberId);
                    onSelectTrip(null);
                    setSelectedPath(null);
                    await loadLocal();
                  }}
                >
                  Clear on-device history
                </button>
              ) : null}
              <button
                type="button"
                className="text-[11px] font-medium text-red-600/80 underline"
                disabled={busy}
                onClick={() => void clearCloudHistory()}
              >
                Clear cloud history
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

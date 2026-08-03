"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DriveTripSummary,
  FamilyHistoryItem,
  FamilyPlaceVisitView,
} from "@forward/shared";
import { Car, ChevronDown, ChevronUp, MapPin, Trash2, X } from "lucide-react";
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
export function LocationHistoryPanel({
  memberId,
  memberName,
  isYou,
  refreshKey = 0,
  selectedTripId,
  onSelectTrip,
  onHighlightPlaces,
  /** When true, keep list collapsed while a route is shown on the map. */
  mapFirst = true,
}: {
  memberId: string;
  memberName?: string;
  isYou: boolean;
  refreshKey?: number;
  selectedTripId: string | null;
  onSelectTrip: (trip: LocalHistoryTrip | null) => void;
  onHighlightPlaces?: (
    places: { name: string; lat: number; lng: number; radiusM: number }[]
  ) => void;
  mapFirst?: boolean;
}) {
  const [range, setRange] = useState<LocalHistoryRange>("day");
  const [items, setItems] = useState<FamilyHistoryItem[]>([]);
  const [localTrips, setLocalTrips] = useState<LocalHistoryTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);

  const loadCloud = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/family/history?memberId=${encodeURIComponent(memberId)}&range=${range}`
      );
      if (!res.ok) {
        setError("Could not load history.");
        return;
      }
      const data = (await res.json()) as {
        items: FamilyHistoryItem[];
      };
      setItems(data.items ?? []);
      setError(null);
      // Do NOT paint stay geofences on the live map just because history loaded —
      // that left a stray orange circle on the overview. Highlights only from
      // an explicit stay tap (or a selected drive route).
    } catch {
      setError("Could not load history.");
    }
  }, [memberId, range]);

  const loadLocal = useCallback(async () => {
    if (!isYou) {
      setLocalTrips([]);
      return;
    }
    try {
      const rows = await listLocalTrips(memberId);
      setLocalTrips(rows);
    } catch {
      // optional
    }
  }, [isYou, memberId]);

  useEffect(() => {
    void loadCloud();
    void loadLocal();
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

  const selectedSummary = useMemo(() => {
    if (!selectedTripId) return null;
    for (const item of items) {
      if (item.kind !== "drive") continue;
      const key = `${item.trip.fromLabel}|${item.trip.toLabel}|${Math.round(item.trip.distanceKm * 10)}`;
      const local = localByKey.get(key);
      if (item.trip.id === selectedTripId || local?.id === selectedTripId) {
        return item.trip;
      }
    }
    return null;
  }, [items, localByKey, selectedTripId]);

  async function selectDrive(trip: DriveTripSummary) {
    const key = `${trip.fromLabel}|${trip.toLabel}|${Math.round(trip.distanceKm * 10)}`;
    const local = localByKey.get(key);
    const selectedIds = new Set(
      [trip.id, local?.id, `cloud-${trip.fromLabel}-${trip.toLabel}-${trip.startedAt ?? ""}`].filter(
        Boolean
      ) as string[]
    );
    if (selectedTripId && selectedIds.has(selectedTripId)) {
      onSelectTrip(null);
      setListOpen(true);
      return;
    }

    if (local && local.path.length >= 2) {
      onSelectTrip(local);
      return;
    }

    let path: LocalHistoryPathPoint[] = [];
    if (trip.id) {
      setBusy(true);
      try {
        const res = await fetch(
          `/api/family/history?tripId=${encodeURIComponent(trip.id)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { path?: LocalHistoryPathPoint[] };
          path = (data.path ?? []).filter((p) => hasCoords(p.lat, p.lng));
        }
      } catch {
        // fall through to A→B
      } finally {
        setBusy(false);
      }
    }

    if (path.length < 2) path = fallbackPath(trip);
    if (path.length < 2) {
      setError("No route points for that drive yet.");
      return;
    }

    onSelectTrip(cloudToLocal(trip, path));
  }

  // Collapsed strip while a route owns the map
  if (mapFirst && selectedTripId && !listOpen) {
    return (
      <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 shrink-0 text-sky-800" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sky-950">
              {selectedSummary
                ? `${selectedSummary.fromLabel} → ${selectedSummary.toLabel}`
                : "Drive on map"}
            </p>
            <p className="truncate text-[10px] text-sky-900/70">
              {selectedSummary
                ? `${selectedSummary.distanceKm.toFixed(1)} km · ${selectedSummary.durationMinutes} min · score ${selectedSummary.driveScore}`
                : "Route shown above · tap History to browse more"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-forward-800 shadow-sm"
            onClick={() => setListOpen(true)}
          >
            History
          </button>
          <button
            type="button"
            className="rounded-full bg-white p-1.5 text-forward-700 shadow-sm"
            aria-label="Clear route"
            onClick={() => {
              onSelectTrip(null);
              setListOpen(true);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {selectedSummary ? (
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

          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-forward-200 bg-white px-3 py-3 text-xs text-forward-500">
              No history in this range yet. Keep Share live on.
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
                      className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                        selected
                          ? "border-brand-blue bg-brand-blue/5"
                          : "border-forward-200 bg-white hover:border-forward-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forward-900 text-white">
                          <Car className="h-3 w-3" />
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
                            {trip.durationMinutes} min · max {trip.maxSpeedKmh} · score{" "}
                            {trip.driveScore}
                            {selected ? " · on map" : ""}
                          </p>
                        </div>
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

          {isYou && localTrips.length > 0 ? (
            <button
              type="button"
              className="text-[11px] font-medium text-forward-500 underline"
              onClick={async () => {
                if (!window.confirm("Clear on-device drive history on this phone?")) return;
                await clearLocalHistory(memberId);
                onSelectTrip(null);
                await loadLocal();
              }}
            >
              Clear on-device history
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

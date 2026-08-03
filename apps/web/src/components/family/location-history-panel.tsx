"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DriveTripSummary,
  FamilyHistoryItem,
  FamilyPlaceVisitView,
} from "@forward/shared";
import { Car, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
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

function cloudToLocal(trip: DriveTripSummary, path: LocalHistoryPathPoint[]): LocalHistoryTrip {
  return {
    id: trip.id ?? `cloud-${trip.fromLabel}-${trip.toLabel}`,
    memberId: trip.memberId ?? "",
    fromLabel: trip.fromLabel,
    toLabel: trip.toLabel,
    startLat: trip.startLat ?? path[0]?.lat ?? 0,
    startLng: trip.startLng ?? path[0]?.lng ?? 0,
    endLat: trip.endLat ?? path[path.length - 1]?.lat ?? 0,
    endLng: trip.endLng ?? path[path.length - 1]?.lng ?? 0,
    path,
    distanceKm: trip.distanceKm,
    durationMinutes: trip.durationMinutes,
    avgSpeedKmh: trip.avgSpeedKmh,
    maxSpeedKmh: trip.maxSpeedKmh,
    estimatedFuelLitres: trip.estimatedFuelLitres ?? null,
    estimatedFuelKwh: trip.estimatedFuelKwh ?? null,
    estimatedFuelCostCad: trip.estimatedFuelCostCad ?? null,
    driveScore: trip.driveScore,
    startedAt: trip.startedAt ?? new Date().toISOString(),
    endedAt: trip.endedAt ?? new Date().toISOString(),
  };
}

/**
 * Life360-style Location history: Today / Month / Year with drives + place stays,
 * drive insights (max speed, hard brakes, accel), and map A→B / visited areas.
 */
export function LocationHistoryPanel({
  memberId,
  memberName,
  isYou,
  refreshKey = 0,
  selectedTripId,
  onSelectTrip,
  onHighlightPlaces,
}: {
  memberId: string;
  memberName?: string;
  isYou: boolean;
  refreshKey?: number;
  selectedTripId: string | null;
  onSelectTrip: (trip: LocalHistoryTrip | null) => void;
  /** Highlight visited place circles on the map for the current range. */
  onHighlightPlaces?: (
    places: { name: string; lat: number; lng: number; radiusM: number }[]
  ) => void;
}) {
  const [range, setRange] = useState<LocalHistoryRange>("day");
  const [items, setItems] = useState<FamilyHistoryItem[]>([]);
  const [localTrips, setLocalTrips] = useState<LocalHistoryTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      const places = (data.items ?? [])
        .filter((i): i is Extract<FamilyHistoryItem, { kind: "stay" }> => i.kind === "stay")
        .map((i) => i.visit)
        .filter(
          (v): v is FamilyPlaceVisitView & { placeLat: number; placeLng: number; placeRadiusM: number } =>
            v.placeLat != null && v.placeLng != null
        )
        .map((v) => ({
          name: v.placeName,
          lat: v.placeLat,
          lng: v.placeLng,
          radiusM: v.placeRadiusM ?? 120,
        }));
      // Dedupe by name
      const seen = new Set<string>();
      const unique = places.filter((p) => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      });
      onHighlightPlaces?.(unique);
    } catch {
      setError("Could not load history.");
    }
  }, [memberId, range, onHighlightPlaces]);

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

  async function selectDrive(trip: DriveTripSummary) {
    const key = `${trip.fromLabel}|${trip.toLabel}|${Math.round(trip.distanceKm * 10)}`;
    const local = localByKey.get(key);
    if (local && local.path.length >= 2) {
      onSelectTrip(selectedTripId === local.id ? null : local);
      return;
    }
    if (!trip.id) {
      if (trip.startLat != null && trip.endLat != null) {
        const fallback = cloudToLocal(trip, [
          {
            lat: trip.startLat,
            lng: trip.startLng!,
            t: trip.startedAt ?? new Date().toISOString(),
            speedKmh: null,
          },
          {
            lat: trip.endLat,
            lng: trip.endLng!,
            t: trip.endedAt ?? new Date().toISOString(),
            speedKmh: null,
          },
        ]);
        onSelectTrip(selectedTripId === fallback.id ? null : fallback);
      }
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/family/history?tripId=${encodeURIComponent(trip.id)}`
      );
      const data = (await res.json()) as { path?: LocalHistoryPathPoint[] };
      let path = data.path ?? [];
      if (path.length < 2 && trip.startLat != null && trip.endLat != null) {
        path = [
          {
            lat: trip.startLat,
            lng: trip.startLng!,
            t: trip.startedAt ?? new Date().toISOString(),
            speedKmh: null,
          },
          {
            lat: trip.endLat,
            lng: trip.endLng!,
            t: trip.endedAt ?? new Date().toISOString(),
            speedKmh: null,
          },
        ];
      }
      const mapped = cloudToLocal(trip, path);
      onSelectTrip(selectedTripId === mapped.id ? null : mapped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-base font-semibold text-forward-900">
          Location history
          {memberName && !isYou ? (
            <span className="font-normal text-forward-500"> · {memberName}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-forward-500">
          Historical areas visited and drives — Today, Month, or Year. Tap a drive for the route;
          stays highlight places on the map.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
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
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              range === value
                ? "bg-forward-900 text-white"
                : "bg-forward-100 text-forward-700 hover:bg-forward-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-forward-500">
        {totals.drives} drive{totals.drives === 1 ? "" : "s"} · {totals.stays} place stay
        {totals.stays === 1 ? "" : "s"} · {totals.km} km
        {totals.cost > 0 ? ` · ~$${totals.cost.toFixed(2)}` : ""}
      </p>

      {error ? <p className="text-xs text-amber-800">{error}</p> : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-forward-200 bg-white px-3 py-4 text-sm text-forward-500">
          No history in this range yet. Keep Share live on — arrivals, place stays, and drives
          appear here (including when the app is in the background).
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {items.map((item) => {
            if (item.kind === "stay") {
              const v = item.visit;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-forward-200 bg-white px-3 py-2.5 text-left hover:border-forward-300"
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
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-forward-900">
                          At {v.placeName}
                          {v.isActive ? (
                            <span className="ml-1 text-xs font-medium text-brand-blue">· now</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-forward-500">
                          {v.isActive
                            ? `Arrived ${formatClock(v.arrivedAt)} · ${v.dwellMinutes} min`
                            : `${formatClock(v.arrivedAt)} – ${
                                v.departedAt ? formatClock(v.departedAt) : "?"
                              } · ${v.dwellMinutes} min`}
                          {v.placeLat != null ? " · tap to show on map" : ""}
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
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-brand-blue bg-brand-blue/5"
                      : "border-forward-200 bg-white hover:border-forward-300"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-forward-900 text-white">
                      <Car className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-forward-900">
                          {trip.fromLabel} → {trip.toLabel}
                        </p>
                        <p className="shrink-0 text-xs font-medium text-forward-700">
                          {trip.distanceKm.toFixed(1)} km
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-forward-500">
                        {trip.startedAt ? formatWhen(trip.startedAt) : formatWhen(item.at)}
                        {selected ? " · on map" : " · tap for route"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-forward-600">
                        <span>{trip.durationMinutes} min</span>
                        <span>avg {trip.avgSpeedKmh} km/h</span>
                        <span className="font-semibold text-forward-800">
                          max {trip.maxSpeedKmh} km/h
                        </span>
                        <span>score {trip.driveScore}</span>
                        {trip.estimatedFuelCostCad != null ? (
                          <span>~${trip.estimatedFuelCostCad.toFixed(2)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>

                {open || selected ? (
                  <div className="mt-1 rounded-xl bg-forward-50 px-3 py-2 text-xs text-forward-700">
                    <p className="font-semibold text-forward-900">Drive insights</p>
                    <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                      <li>Top speed · {trip.maxSpeedKmh} km/h</li>
                      <li>Avg speed · {trip.avgSpeedKmh} km/h</li>
                      <li>Hard brakes · {trip.hardBraking}</li>
                      <li>Rapid accel · {trip.rapidAcceleration}</li>
                      <li>Drive score · {trip.driveScore}/100 ({trip.band})</li>
                      <li>
                        Unusual events · {trip.unusualRouteEvents}
                      </li>
                    </ul>
                    {isYou &&
                    localByKey.has(
                      `${trip.fromLabel}|${trip.toLabel}|${Math.round(trip.distanceKm * 10)}`
                    ) ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600"
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
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete phone copy of this drive
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className="w-full text-red-700"
          onClick={async () => {
            if (!window.confirm("Delete all on-device route paths stored on this phone?")) return;
            setBusy(true);
            try {
              await clearLocalHistory(memberId);
              onSelectTrip(null);
              await loadLocal();
            } finally {
              setBusy(false);
            }
          }}
        >
          Clear phone route cache
        </Button>
      ) : null}
    </div>
  );
}

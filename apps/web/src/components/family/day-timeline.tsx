"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DriveTripSummary,
  FamilyMapMemberView,
  FamilyPlaceVisitView,
} from "@forward/shared";
import { Car, MapPin } from "lucide-react";
import { listLocalTrips } from "@/lib/family-map/local-history-store";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";
import { TripRouteThumb } from "@/components/family/trip-route-thumb";
import { DriveEventsStrip } from "@/components/family/drive-events-strip";
import { fetchRouteForDriveTrip } from "@/lib/family-map/fetch-trip-route";

type TimelineItem =
  | {
      kind: "drive";
      id: string;
      at: number;
      trip: LocalHistoryTrip;
      cloudSource?: DriveTripSummary;
      fromCloud?: boolean;
    }
  | {
      kind: "stay";
      id: string;
      at: number;
      placeName: string;
      minutes: number | null;
      live: boolean;
    };

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
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

function ensureTripPath(trip: LocalHistoryTrip): LocalHistoryTrip {
  const path = (trip.path ?? []).filter((p) => hasCoords(p.lat, p.lng));
  if (path.length >= 2) return { ...trip, path };
  if (hasCoords(trip.startLat, trip.startLng) && hasCoords(trip.endLat, trip.endLng)) {
    return {
      ...trip,
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
  return { ...trip, path };
}

function cloudTripToLocal(
  memberId: string,
  t: DriveTripSummary,
  index: number
): LocalHistoryTrip {
  const startedAt = t.startedAt ?? new Date(Date.now() - t.durationMinutes * 60_000).toISOString();
  const endedAt = t.endedAt ?? new Date().toISOString();
  const startLat = hasCoords(t.startLat, t.startLng) ? t.startLat! : 0;
  const startLng = hasCoords(t.startLat, t.startLng) ? t.startLng! : 0;
  const endLat = hasCoords(t.endLat, t.endLng) ? t.endLat! : 0;
  const endLng = hasCoords(t.endLat, t.endLng) ? t.endLng! : 0;
  const path =
    hasCoords(startLat, startLng) && hasCoords(endLat, endLng)
      ? [
          { lat: startLat, lng: startLng, t: startedAt, speedKmh: null },
          { lat: endLat, lng: endLng, t: endedAt, speedKmh: null },
        ]
      : [];
  return {
    id: t.id ?? `cloud-${memberId}-${index}-${t.fromLabel}-${t.toLabel}`,
    memberId: t.memberId ?? memberId,
    fromLabel: t.fromLabel,
    toLabel: t.toLabel,
    startLat,
    startLng,
    endLat,
    endLng,
    path,
    distanceKm: t.distanceKm,
    durationMinutes: t.durationMinutes,
    avgSpeedKmh: t.avgSpeedKmh,
    maxSpeedKmh: t.maxSpeedKmh,
    estimatedFuelLitres: t.estimatedFuelLitres ?? null,
    estimatedFuelKwh: t.estimatedFuelKwh ?? null,
    estimatedFuelCostCad: t.estimatedFuelCostCad ?? null,
    driveScore: t.driveScore,
    hardBraking: t.hardBraking,
    rapidAcceleration: t.rapidAcceleration,
    unusualRouteEvents: t.unusualRouteEvents,
    startedAt,
    endedAt,
  };
}

/**
 * Life360-style “Today”: local drives + cloud drives (background) + place stays.
 */
export function DayTimeline({
  memberId,
  isYou,
  member,
  refreshKey = 0,
  selectedTripId,
  onSelectTrip,
  placeVisitsToday = [],
  recentCloudTrips = [],
}: {
  memberId: string;
  isYou: boolean;
  member: FamilyMapMemberView;
  refreshKey?: number;
  selectedTripId?: string | null;
  onSelectTrip?: (trip: LocalHistoryTrip | null) => void;
  placeVisitsToday?: FamilyPlaceVisitView[];
  recentCloudTrips?: DriveTripSummary[];
}) {
  const [trips, setTrips] = useState<LocalHistoryTrip[]>([]);
  const [routeBusyId, setRouteBusyId] = useState<string | null>(null);
  const [resolvedPaths, setResolvedPaths] = useState<Record<string, LocalHistoryTrip["path"]>>(
    {}
  );

  const load = useCallback(async () => {
    if (!isYou) {
      setTrips([]);
      return;
    }
    try {
      const rows = await listLocalTrips(memberId);
      setTrips(rows);
    } catch {
      setTrips([]);
    }
  }, [isYou, memberId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const items = useMemo(() => {
    const dayStart = startOfLocalDay();
    const out: TimelineItem[] = [];
    const localIds = new Set(trips.map((t) => `${t.fromLabel}|${t.toLabel}|${t.distanceKm}`));

    for (const trip of trips) {
      const ended = new Date(trip.endedAt).getTime();
      if (ended < dayStart) continue;
      out.push({
        kind: "drive",
        id: trip.id,
        at: ended,
        trip,
      });
    }

    // Background GPS writes cloud trips — show for anyone in the household.
    recentCloudTrips.forEach((ct, index) => {
      const key = `${ct.fromLabel}|${ct.toLabel}|${ct.distanceKm}`;
      if (localIds.has(key)) return;
      const trip = cloudTripToLocal(memberId, ct, index);
      out.push({
        kind: "drive",
        id: trip.id,
        at: Date.now() - index * 60_000,
        trip,
        cloudSource: ct,
        fromCloud: true,
      });
    });

    const visitRows = placeVisitsToday.filter((v) => v.memberId === memberId);
    if (visitRows.length > 0) {
      for (const v of visitRows) {
        const arrived = new Date(v.arrivedAt).getTime();
        if (!v.isActive && arrived < dayStart) continue;
        out.push({
          kind: "stay",
          id: v.id,
          at: v.isActive ? Date.now() : new Date(v.departedAt ?? v.arrivedAt).getTime(),
          placeName: v.placeName,
          minutes: v.dwellMinutes,
          live: v.isActive,
        });
      }
    } else if (member.placeName) {
      out.push({
        kind: "stay",
        id: `stay-${member.placeName}`,
        at: Date.now(),
        placeName: member.placeName,
        minutes: member.timeAtPlaceMinutes ?? null,
        live: true,
      });
    }

    out.sort((a, b) => b.at - a.at);
    return out.slice(0, 12);
  }, [
    trips,
    memberId,
    member.placeName,
    member.timeAtPlaceMinutes,
    placeVisitsToday,
    recentCloudTrips,
  ]);

  async function selectTimelineDrive(item: Extract<TimelineItem, { kind: "drive" }>) {
    const selected = selectedTripId === item.trip.id;
    if (selected) {
      onSelectTrip?.(null);
      return;
    }

    // Dense local path already has the curve.
    if (!item.fromCloud && item.trip.path.length >= 3) {
      onSelectTrip?.(item.trip);
      return;
    }

    const cached = resolvedPaths[item.trip.id];
    if (cached && cached.length >= 3) {
      onSelectTrip?.({ ...item.trip, path: cached });
      return;
    }

    setRouteBusyId(item.trip.id);
    try {
      const source = item.cloudSource;
      let path =
        source != null
          ? await fetchRouteForDriveTrip(source, memberId)
          : item.trip.id
            ? await fetchRouteForDriveTrip(
                {
                  id: item.trip.id,
                  memberId: item.trip.memberId || memberId,
                  fromLabel: item.trip.fromLabel,
                  toLabel: item.trip.toLabel,
                  distanceKm: item.trip.distanceKm,
                  durationMinutes: item.trip.durationMinutes,
                  avgSpeedKmh: item.trip.avgSpeedKmh,
                  maxSpeedKmh: item.trip.maxSpeedKmh,
                  hardBraking: item.trip.hardBraking ?? 0,
                  rapidAcceleration: item.trip.rapidAcceleration ?? 0,
                  unusualRouteEvents: item.trip.unusualRouteEvents ?? 0,
                  driveScore: item.trip.driveScore,
                  band: "safe",
                  startedAt: item.trip.startedAt,
                  endedAt: item.trip.endedAt,
                  startLat: item.trip.startLat,
                  startLng: item.trip.startLng,
                  endLat: item.trip.endLat,
                  endLng: item.trip.endLng,
                },
                memberId
              )
            : [];

      if (path.length < 2) {
        path = ensureTripPath(item.trip).path;
      }
      if (path.length < 2) return;

      setResolvedPaths((prev) => ({ ...prev, [item.trip.id]: path }));
      onSelectTrip?.({ ...item.trip, path });
    } finally {
      setRouteBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-3 sm:p-4">
      <p className="font-display text-base font-semibold text-forward-900">Today</p>
      <p className="text-xs text-forward-500">
        Drives and stays — tap a drive to show the GPS route on the map.
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-forward-200 px-3 py-4 text-xs text-forward-500">
          Nothing on the timeline yet. Keep Share live on while you’re out.
        </p>
      ) : (
        <ul className="relative mt-4 ml-3 border-l border-forward-200 pl-4">
          {items.map((item) => {
            if (item.kind === "stay") {
              return (
                <li key={item.id} className="relative pb-4">
                  <span className="absolute -left-[1.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-white">
                    <MapPin className="h-3 w-3" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-forward-400">
                    {item.live ? "Happening now" : formatClock(item.at)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-forward-900">
                    At {item.placeName}
                    {item.minutes != null ? (
                      <span className="font-normal text-forward-500"> · {item.minutes} min</span>
                    ) : null}
                  </p>
                </li>
              );
            }

            const selected = selectedTripId === item.trip.id;
            const pathOverride = resolvedPaths[item.trip.id];
            const withPath = ensureTripPath(
              pathOverride ? { ...item.trip, path: pathOverride } : item.trip
            );
            const canShowRoute = withPath.path.length >= 2;
            const loadingRoute = routeBusyId === item.trip.id;
            return (
              <li key={item.id} className="relative pb-4">
                <span className="absolute -left-[1.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-forward-800 text-white">
                  <Car className="h-3 w-3" />
                </span>
                <button
                  type="button"
                  disabled={!canShowRoute || loadingRoute}
                  onClick={() => void selectTimelineDrive(item)}
                  className={`w-full rounded-xl px-2 py-1.5 text-left transition ${
                    selected ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-forward-50"
                  } ${!canShowRoute ? "cursor-default" : ""}`}
                >
                  <TripRouteThumb
                    path={withPath.path}
                    start={
                      hasCoords(withPath.startLat, withPath.startLng)
                        ? { lat: withPath.startLat, lng: withPath.startLng }
                        : null
                    }
                    end={
                      hasCoords(withPath.endLat, withPath.endLng)
                        ? { lat: withPath.endLat, lng: withPath.endLng }
                        : null
                    }
                    className="mb-2 h-16"
                  />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-forward-400">
                    {formatClock(new Date(item.trip.startedAt).getTime())} –{" "}
                    {formatClock(item.at)}
                    {item.fromCloud ? " · synced" : ""}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-forward-900">
                    {item.trip.fromLabel} → {item.trip.toLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-forward-500">
                    {item.trip.distanceKm.toFixed(1)} km · {item.trip.durationMinutes} min ·{" "}
                    {Math.round(item.trip.maxSpeedKmh)} km/h max · score {item.trip.driveScore}
                    {loadingRoute
                      ? " · loading route…"
                      : canShowRoute
                        ? selected
                          ? " · showing on map"
                          : " · tap to show route"
                        : ""}
                  </p>
                  {selected ? (
                    <div className="mt-2">
                      <DriveEventsStrip
                        maxSpeedKmh={withPath.maxSpeedKmh}
                        hardBraking={withPath.hardBraking ?? 0}
                        rapidAcceleration={withPath.rapidAcceleration ?? 0}
                        unusualRouteEvents={withPath.unusualRouteEvents ?? 0}
                        compact
                      />
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

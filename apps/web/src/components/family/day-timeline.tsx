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

type TimelineItem =
  | {
      kind: "drive";
      id: string;
      at: number;
      trip: LocalHistoryTrip;
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

function cloudTripToLocal(
  memberId: string,
  t: DriveTripSummary,
  index: number
): LocalHistoryTrip {
  const endedAt = new Date().toISOString();
  return {
    id: `cloud-${memberId}-${index}-${t.fromLabel}-${t.toLabel}`,
    memberId,
    fromLabel: t.fromLabel,
    toLabel: t.toLabel,
    startLat: 0,
    startLng: 0,
    endLat: 0,
    endLng: 0,
    path: [],
    distanceKm: t.distanceKm,
    durationMinutes: t.durationMinutes,
    avgSpeedKmh: t.avgSpeedKmh,
    maxSpeedKmh: t.maxSpeedKmh,
    estimatedFuelLitres: t.estimatedFuelLitres ?? null,
    estimatedFuelKwh: t.estimatedFuelKwh ?? null,
    estimatedFuelCostCad: t.estimatedFuelCostCad ?? null,
    driveScore: t.driveScore,
    startedAt: new Date(Date.now() - t.durationMinutes * 60_000).toISOString(),
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

    // Background GPS writes cloud trips — show them when phone history is empty/thin
    recentCloudTrips.forEach((ct, index) => {
      const key = `${ct.fromLabel}|${ct.toLabel}|${ct.distanceKm}`;
      if (localIds.has(key)) return;
      const trip = cloudTripToLocal(memberId, ct, index);
      out.push({
        kind: "drive",
        id: trip.id,
        at: Date.now() - index * 60_000,
        trip,
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
    member.placeName,
    member.timeAtPlaceMinutes,
    placeVisitsToday,
    recentCloudTrips,
    memberId,
  ]);

  if (!isYou) {
    return (
      <div>
        <p className="font-display text-sm font-semibold text-forward-900">Today</p>
        <p className="mt-1 text-xs text-forward-500">
          Drive history on their phone. Place arrivals sync to the household when they share.
        </p>
        {member.placeName ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-forward-50 px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-brand-blue" />
            <span>
              Now at <strong>{member.placeName}</strong>
              {member.timeAtPlaceMinutes != null ? ` · ${member.timeAtPlaceMinutes} min` : ""}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  const driveCount = items.filter((i) => i.kind === "drive").length;
  const stayCount = items.filter((i) => i.kind === "stay").length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-sm font-semibold text-forward-900">Today</p>
        <p className="text-[11px] text-forward-400">
          {driveCount} drives · {stayCount} stays
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-xs text-forward-500">
          No drives or place stays yet today. Keep Share live on — arrivals and routes show here.
        </p>
      ) : (
        <ol className="relative mt-3 space-y-0 border-l-2 border-forward-100 pl-4">
          {items.map((item) => {
            if (item.kind === "stay") {
              return (
                <li key={item.id} className="relative pb-4">
                  <span className="absolute -left-[1.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-white">
                    <MapPin className="h-3 w-3" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-forward-400">
                    {item.live ? "Now" : formatClock(item.at)}
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
            const canShowRoute = item.trip.path.length > 1;
            return (
              <li key={item.id} className="relative pb-4">
                <span className="absolute -left-[1.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-forward-800 text-white">
                  <Car className="h-3 w-3" />
                </span>
                <button
                  type="button"
                  disabled={!canShowRoute}
                  onClick={() => {
                    if (!canShowRoute) return;
                    onSelectTrip?.(selected ? null : item.trip);
                  }}
                  className={`w-full rounded-xl px-2 py-1.5 text-left transition ${
                    selected ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-forward-50"
                  } ${!canShowRoute ? "cursor-default" : ""}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-forward-400">
                    {formatClock(new Date(item.trip.startedAt).getTime())} –{" "}
                    {formatClock(item.at)}
                    {item.fromCloud ? " · synced" : ""}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-forward-900">
                    {item.trip.fromLabel} → {item.trip.toLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-forward-500">
                    {item.trip.distanceKm.toFixed(1)} km · {item.trip.durationMinutes} min · score{" "}
                    {item.trip.driveScore}
                    {item.trip.estimatedFuelCostCad != null
                      ? ` · ~$${item.trip.estimatedFuelCostCad.toFixed(2)}`
                      : ""}
                    {canShowRoute
                      ? selected
                        ? " · showing on map"
                        : " · tap to show route"
                      : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

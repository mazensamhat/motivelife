"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DriveScoreBubble } from "@/components/family/drive-score-bubble";
import { fetchRouteForDriveTrip } from "@/lib/family-map/fetch-trip-route";
import { FAMILY_BUBBLE_CARD } from "@/lib/family-map/ui-theme";

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
 * Life360-style “Today”: cloud history for this member + local drives (you).
 * Always hits `/api/family/history` so kids aren’t empty when they’re missing
 * from the thin household recentTrips slice on map state.
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
  const [cloudTrips, setCloudTrips] = useState<DriveTripSummary[]>([]);
  const [cloudVisits, setCloudVisits] = useState<FamilyPlaceVisitView[]>([]);
  /** Which API range filled cloudTrips — drives month fallback past local midnight. */
  const [cloudRange, setCloudRange] = useState<"day" | "month">("day");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeBusyId, setRouteBusyId] = useState<string | null>(null);
  const [resolvedPaths, setResolvedPaths] = useState<Record<string, LocalHistoryTrip["path"]>>(
    {}
  );
  const memberIdRef = useRef(memberId);
  const selectGenRef = useRef(0);

  useEffect(() => {
    memberIdRef.current = memberId;
    setResolvedPaths({});
    setRouteBusyId(null);
    setCloudTrips([]);
    setCloudVisits([]);
    selectGenRef.current += 1;
  }, [memberId]);

  const loadLocal = useCallback(async () => {
    if (!isYou) {
      setTrips([]);
      return;
    }
    try {
      const rows = await listLocalTrips(memberId);
      if (memberIdRef.current !== memberId) return;
      setTrips(rows);
    } catch {
      if (memberIdRef.current === memberId) setTrips([]);
    }
  }, [isYou, memberId]);

  const loadCloud = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError(null);
      try {
        const tz = new Date().getTimezoneOffset();
        // Prefer Today; if empty, fall back to Month so history never looks "wiped"
        // when the family simply hasn't driven since midnight.
        let trips: DriveTripSummary[] = [];
        let visits: FamilyPlaceVisitView[] = [];
        let usedRange: "day" | "month" = "day";
        for (const range of ["day", "month"] as const) {
          const res = await fetch(
            `/api/family/history?memberId=${encodeURIComponent(memberId)}&range=${range}&tzOffsetMinutes=${tz}`,
            { signal }
          );
          if (signal?.aborted || memberIdRef.current !== memberId) return;
          if (!res.ok) {
            if (range === "month") setLoadError("Could not load today’s history.");
            continue;
          }
          const data = (await res.json()) as {
            trips?: DriveTripSummary[];
            visits?: FamilyPlaceVisitView[];
            items?: Array<
              | { kind: "drive"; trip: DriveTripSummary }
              | { kind: "stay"; visit: FamilyPlaceVisitView }
            >;
          };
          const fromItemsDrives =
            data.items
              ?.filter((i): i is { kind: "drive"; trip: DriveTripSummary } => i.kind === "drive")
              .map((i) => i.trip) ?? [];
          const fromItemsVisits =
            data.items
              ?.filter(
                (i): i is { kind: "stay"; visit: FamilyPlaceVisitView } => i.kind === "stay"
              )
              .map((i) => i.visit) ?? [];
          trips = data.trips?.length ? data.trips : fromItemsDrives;
          visits = data.visits?.length ? data.visits : fromItemsVisits;
          usedRange = range;
          if (trips.length > 0 || visits.length > 0 || range === "month") break;
        }
        if (signal?.aborted || memberIdRef.current !== memberId) return;
        setCloudTrips(trips);
        setCloudVisits(visits);
        setCloudRange(usedRange);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (memberIdRef.current === memberId) {
          setLoadError("Could not load today’s history.");
        }
      } finally {
        if (!signal?.aborted && memberIdRef.current === memberId) {
          setLoading(false);
        }
      }
    },
    [memberId]
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadLocal();
    void loadCloud(ac.signal);
    return () => ac.abort();
  }, [loadLocal, loadCloud, refreshKey]);

  const items = useMemo(() => {
    const dayStart = startOfLocalDay();
    // When API fell back to month, keep older drives — don't re-filter to local midnight.
    const minAt = cloudRange === "month" ? 0 : dayStart;
    const out: TimelineItem[] = [];
    const localIds = new Set(trips.map((t) => `${t.fromLabel}|${t.toLabel}|${t.distanceKm}`));

    for (const trip of trips) {
      const ended = new Date(trip.endedAt).getTime();
      if (ended < minAt) continue;
      out.push({
        kind: "drive",
        id: trip.id,
        at: ended,
        trip,
      });
    }

    // Prefer API history for this member; fall back to map-state crumbs.
    const cloudSource =
      cloudTrips.length > 0
        ? cloudTrips
        : recentCloudTrips.filter((ct) => !ct.memberId || ct.memberId === memberId);

    cloudSource.forEach((ct, index) => {
      if (ct.memberId && ct.memberId !== memberId) return;
      const key = `${ct.fromLabel}|${ct.toLabel}|${ct.distanceKm}`;
      if (localIds.has(key)) return;
      const trip = cloudTripToLocal(memberId, ct, index);
      const live = !ct.endedAt || ct.toLabel === "In progress";
      const at = live
        ? Date.now()
        : ct.endedAt
          ? Date.parse(ct.endedAt)
          : Date.now() - index * 60_000;
      if (!live && at < minAt) return;
      out.push({
        kind: "drive",
        id: trip.id,
        at,
        trip,
        cloudSource: ct,
        fromCloud: true,
      });
    });

    // Live pin says driving but trip row missing (ingest lag) — still show a row.
    const hasLiveDrive = out.some(
      (i) => i.kind === "drive" && i.trip.toLabel === "In progress"
    );
    if (
      !hasLiveDrive &&
      (member.presence === "driving" ||
        (member.speedKmh != null && member.speedKmh >= 14))
    ) {
      const now = new Date().toISOString();
      out.unshift({
        kind: "drive",
        id: `live-drive-${memberId}`,
        at: Date.now(),
        trip: {
          id: `live-drive-${memberId}`,
          memberId,
          fromLabel: member.placeName ?? "On the road",
          toLabel: "In progress",
          startLat: member.lat ?? 0,
          startLng: member.lng ?? 0,
          endLat: member.lat ?? 0,
          endLng: member.lng ?? 0,
          path:
            member.lat != null && member.lng != null
              ? [{ lat: member.lat, lng: member.lng, t: now, speedKmh: member.speedKmh }]
              : [],
          distanceKm: 0,
          durationMinutes: 0,
          avgSpeedKmh: Math.round(member.speedKmh ?? 0),
          maxSpeedKmh: Math.round(member.speedKmh ?? 0),
          estimatedFuelLitres: null,
          estimatedFuelKwh: null,
          estimatedFuelCostCad: null,
          driveScore: 100,
          hardBraking: 0,
          rapidAcceleration: 0,
          unusualRouteEvents: 0,
          startedAt: now,
          endedAt: now,
        },
        fromCloud: true,
      });
    }

    const visitRows = [
      ...cloudVisits.filter((v) => !v.memberId || v.memberId === memberId),
      ...placeVisitsToday.filter((v) => v.memberId === memberId),
    ];
    const seenVisit = new Set<string>();
    if (visitRows.length > 0) {
      for (const v of visitRows) {
        if (seenVisit.has(v.id)) continue;
        seenVisit.add(v.id);
        const arrived = new Date(v.arrivedAt).getTime();
        if (!v.isActive && arrived < minAt) continue;
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
    cloudTrips,
    cloudVisits,
    cloudRange,
    memberId,
    member.placeName,
    member.timeAtPlaceMinutes,
    member.presence,
    member.speedKmh,
    member.lat,
    member.lng,
    placeVisitsToday,
    recentCloudTrips,
  ]);

  async function selectTimelineDrive(item: Extract<TimelineItem, { kind: "drive" }>) {
    const forMember = memberId;
    const gen = ++selectGenRef.current;
    const stillMine = () =>
      selectGenRef.current === gen && memberIdRef.current === forMember;

    const selected = selectedTripId === item.trip.id;
    if (selected) {
      onSelectTrip?.(null);
      return;
    }

    // Local paths: keep GPS; heal moderate BG gaps without inventing a corridor.
    if (!item.fromCloud && item.trip.path.length >= 2) {
      setRouteBusyId(item.trip.id);
      try {
        const { enrichPathWithRoadRoute } = await import(
          "@/lib/family-map/road-route"
        );
        const routed = await enrichPathWithRoadRoute(item.trip.path, {
          force: item.trip.path.length <= 2,
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
            : item.trip.path;
        setResolvedPaths((prev) => ({ ...prev, [item.trip.id]: path }));
        onSelectTrip?.({ ...item.trip, memberId: forMember, path });
      } finally {
        if (stillMine()) setRouteBusyId(null);
      }
      return;
    }

    const cached = resolvedPaths[item.trip.id];
    if (cached && cached.length >= 3) {
      onSelectTrip?.({ ...item.trip, memberId: forMember, path: cached });
      return;
    }

    setRouteBusyId(item.trip.id);
    try {
      const source = item.cloudSource;
      let path =
        source != null
          ? await fetchRouteForDriveTrip(source, forMember)
          : item.trip.id
            ? await fetchRouteForDriveTrip(
                {
                  id: item.trip.id,
                  memberId: item.trip.memberId || forMember,
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
                forMember
              )
            : [];

      if (!stillMine()) return;
      if (path.length < 2) {
        path = ensureTripPath(item.trip).path;
      }
      if (path.length < 2) return;

      // Prefer GPS breadcrumbs. Only true A→B gets estimated road directions.
      {
        const { enrichPathWithRoadRoute } = await import("@/lib/family-map/road-route");
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
      }

      if (!stillMine()) return;
      setResolvedPaths((prev) => ({ ...prev, [item.trip.id]: path }));
      onSelectTrip?.({ ...item.trip, memberId: forMember, path });
    } finally {
      if (stillMine()) setRouteBusyId(null);
    }
  }

  return (
    <section className={`${FAMILY_BUBBLE_CARD} !p-3 sm:!p-4`}>
      <p className="font-display text-base font-semibold text-forward-900">
        {cloudRange === "month" ? "Recent history" : "Today"}
      </p>
      <p className="text-xs text-forward-500">
        Drives and stays — tap a drive to show the GPS route on the map.
      </p>

      {loadError ? (
        <p className="mt-3 text-xs text-amber-800">{loadError}</p>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-forward-200 px-3 py-4 text-xs text-forward-500">
          Loading today’s history…
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-forward-200 px-3 py-4 text-xs text-forward-500">
          Nothing on the timeline yet. Open Full history for earlier drives, and keep Share live on while you’re out.
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
                  <p className="family-timeline-meta text-[11px] font-semibold uppercase text-forward-400">
                    {item.live ? "Happening now" : formatClock(item.at)}
                  </p>
                  <p className="family-timeline-title mt-0.5 text-sm font-semibold text-forward-900">
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
                  <p className="family-timeline-meta text-[11px] font-semibold uppercase text-forward-400">
                    {item.trip.toLabel === "In progress" ? (
                      <>Driving now · {formatClock(new Date(item.trip.startedAt).getTime())}</>
                    ) : (
                      <>
                        {formatClock(new Date(item.trip.startedAt).getTime())} –{" "}
                        {formatClock(item.at)}
                        {item.fromCloud ? " · synced" : ""}
                      </>
                    )}
                  </p>
                  <p className="family-timeline-title mt-0.5 text-sm font-semibold text-forward-900">
                    {item.trip.fromLabel} → {item.trip.toLabel}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="family-timeline-meta min-w-0 flex-1 text-xs text-forward-500">
                      {item.trip.toLabel === "In progress"
                        ? `${Math.round(item.trip.avgSpeedKmh || item.trip.maxSpeedKmh)} km/h live`
                        : `${item.trip.distanceKm.toFixed(1)} km · ${item.trip.durationMinutes} min · ${Math.round(item.trip.maxSpeedKmh)} km/h max`}
                      {item.trip.toLabel !== "In progress" &&
                        (loadingRoute
                          ? " · loading route…"
                          : canShowRoute
                            ? selected
                              ? " · showing on map"
                              : " · tap to show route"
                            : "")}
                    </p>
                    {item.trip.toLabel !== "In progress" ? (
                      <DriveScoreBubble
                        score={item.trip.driveScore}
                        size="sm"
                        showLabel={false}
                      />
                    ) : null}
                  </div>
                  {selected ? (
                    <div className="mt-2">
                      <DriveEventsStrip
                        maxSpeedKmh={withPath.maxSpeedKmh}
                        phoneUsageEvents={withPath.phoneUsageEvents ?? 0}
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

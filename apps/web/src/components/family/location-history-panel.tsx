"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import {
  clearLocalHistory,
  deleteLocalTrip,
  listLocalTrips,
} from "@/lib/family-map/local-history-store";
import { filterAndSortTrips } from "@/lib/family-map/local-trip-engine";
import type {
  LocalHistoryRange,
  LocalHistorySort,
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

export function LocationHistoryPanel({
  memberId,
  isYou,
  refreshKey = 0,
  selectedTripId,
  onSelectTrip,
}: {
  memberId: string;
  isYou: boolean;
  /** Bump when a new trip completes so the list refreshes. */
  refreshKey?: number;
  selectedTripId: string | null;
  onSelectTrip: (trip: LocalHistoryTrip | null) => void;
}) {
  const [trips, setTrips] = useState<LocalHistoryTrip[]>([]);
  const [range, setRange] = useState<LocalHistoryRange>("day");
  const [sort, setSort] = useState<LocalHistorySort>("newest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isYou) return;
    try {
      const rows = await listLocalTrips(memberId);
      setTrips(rows);
      setError(null);
    } catch {
      setError("On-device history isn’t available in this browser session.");
    }
  }, [isYou, memberId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const visible = useMemo(
    () => filterAndSortTrips(trips, range, sort),
    [trips, range, sort]
  );

  const totals = useMemo(() => {
    const km = visible.reduce((a, t) => a + t.distanceKm, 0);
    const cost = visible.reduce((a, t) => a + (t.estimatedFuelCostCad ?? 0), 0);
    return { km: Number(km.toFixed(1)), cost: Number(cost.toFixed(2)), count: visible.length };
  }, [visible]);

  if (!isYou) {
    return (
      <div className="rounded-2xl border border-forward-200 bg-forward-50 px-4 py-3 text-sm text-forward-600">
        Drive history stays on each person’s phone — not in the cloud. Open Family Map on their
        device while live sharing is on to build their route history.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-base font-semibold text-forward-900">Location history</p>
        <p className="mt-0.5 text-xs text-forward-500">
          Stored on this phone only. Recorded while live sharing is on. You can delete anytime.
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

      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-forward-500">
          Sort{" "}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as LocalHistorySort)}
            className="ml-1 rounded-lg border border-forward-200 bg-white px-2 py-1 text-xs text-forward-800"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="longest">Longest</option>
            <option value="costliest">Highest fuel cost</option>
          </select>
        </label>
        <p className="text-xs text-forward-500">
          {totals.count} drive{totals.count === 1 ? "" : "s"} · {totals.km} km
          {totals.cost > 0 ? ` · ~$${totals.cost.toFixed(2)}` : ""}
        </p>
      </div>

      {error ? <p className="text-xs text-amber-800">{error}</p> : null}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-forward-200 bg-white px-3 py-4 text-sm text-forward-500">
          No drives in this range yet. Keep live location on during a trip — routes and insights
          save here when you stop.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {visible.map((trip) => {
            const selected = selectedTripId === trip.id;
            return (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => onSelectTrip(selected ? null : trip)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-brand-blue bg-brand-blue/5"
                      : "border-forward-200 bg-white hover:border-forward-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-forward-900">
                        {trip.fromLabel} → {trip.toLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-forward-500">{formatWhen(trip.startedAt)}</p>
                    </div>
                    <p className="shrink-0 text-xs font-medium text-forward-700">
                      {trip.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-forward-600">
                    <span>{trip.durationMinutes.toFixed(0)} min</span>
                    <span>avg {trip.avgSpeedKmh.toFixed(0)} km/h</span>
                    <span>max {trip.maxSpeedKmh.toFixed(0)} km/h</span>
                    <span>score {trip.driveScore}</span>
                    {trip.estimatedFuelCostCad != null ? (
                      <span>~${trip.estimatedFuelCostCad.toFixed(2)} fuel</span>
                    ) : null}
                  </div>
                </button>
                {selected ? (
                  <div className="mt-1 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await deleteLocalTrip(trip.id);
                          onSelectTrip(null);
                          await load();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete this drive
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {trips.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className="w-full text-red-700"
          onClick={async () => {
            if (!window.confirm("Delete all location history stored on this phone?")) return;
            setBusy(true);
            try {
              await clearLocalHistory(memberId);
              onSelectTrip(null);
              await load();
            } finally {
              setBusy(false);
            }
          }}
        >
          Clear all history on this phone
        </Button>
      ) : null}
    </div>
  );
}

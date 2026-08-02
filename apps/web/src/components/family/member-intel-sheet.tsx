"use client";

import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import { X } from "lucide-react";

export function MemberIntelSheet({
  member,
  state,
  onClose,
}: {
  member: FamilyMapMemberView;
  state: FamilyMapState;
  onClose: () => void;
}) {
  const trip = state.recentTrips[0];
  const place = state.places.find((p) => p.name === member.placeName);
  const lastFix = member.lastLocationAt
    ? new Date(member.lastLocationAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="family-intel-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-[500] mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="overflow-hidden rounded-3xl border border-forward-200/80 bg-white shadow-2xl shadow-forward-900/20">
        <div className="flex items-start gap-3 px-4 pb-2 pt-4">
          <span
            className="mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow"
            style={{ background: member.color }}
          >
            {member.displayName.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="truncate font-display text-xl font-semibold text-forward-900">
                  {member.displayName}
                  {member.isYou ? " · You" : ""}
                </h2>
                <p className="mt-0.5 text-sm text-forward-600">{member.statusLabel}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-forward-500 hover:bg-forward-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          <IntelStat
            label="ETA"
            value={member.etaMinutes != null ? `${member.etaMinutes}m` : "—"}
          />
          <IntelStat
            label="Speed"
            value={member.speedKmh != null ? `${Math.round(member.speedKmh)}` : "—"}
            unit={member.speedKmh != null ? "km/h" : undefined}
          />
          <IntelStat
            label="Battery"
            value={member.batteryPercent != null ? `${member.batteryPercent}%` : "—"}
          />
        </div>

        <div className="space-y-3 border-t border-forward-100 px-4 py-3 text-sm">
          <IntelRow
            label="Likely destination"
            value={
              member.likelyDestination
                ? `${member.likelyDestination}${
                    member.destinationConfidence != null
                      ? ` · ${Math.round(member.destinationConfidence * 100)}%`
                      : ""
                  }`
                : "Learning…"
            }
          />
          <IntelRow
            label="Current place"
            value={
              member.placeName
                ? `${member.placeName}${
                    member.timeAtPlaceMinutes != null
                      ? ` · ${member.timeAtPlaceMinutes} min`
                      : ""
                  }`
                : "On the move"
            }
          />
          <IntelRow
            label="Drive score"
            value={
              member.driveScoreRecent != null ? `${member.driveScoreRecent}/100` : "No recent trip"
            }
          />
          {place?.insight ? <IntelRow label="Place intel" value={place.insight} /> : null}
          {trip && member.isYou ? (
            <IntelRow
              label="Last trip"
              value={`${trip.fromLabel} → ${trip.toLabel} · ${trip.driveScore}`}
            />
          ) : null}
          <IntelRow label="Last update" value={lastFix ?? "Waiting for location"} />
          {member.isSimulated ? (
            <p className="text-xs text-forward-500">Sample household member for preview.</p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-forward-100 px-4 py-3">
          {["Message", "Call", "Navigate"].map((action) => (
            <button
              key={action}
              type="button"
              className="flex-1 rounded-xl bg-forward-100 py-2.5 text-sm font-semibold text-forward-800 active:bg-forward-200"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntelStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl bg-forward-50 px-3 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-500">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold text-forward-900">
        {value}
        {unit ? <span className="ml-0.5 text-xs font-medium text-forward-500">{unit}</span> : null}
      </p>
    </div>
  );
}

function IntelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-forward-500">{label}</span>
      <span className="text-right font-medium text-forward-900">{value}</span>
    </div>
  );
}

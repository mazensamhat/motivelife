"use client";

import type { ReactNode } from "react";
import type { FamilyMapState } from "@forward/shared";
import { Activity, Brain, Car, MapPinned, Sparkles } from "lucide-react";

function KpiCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-xl border border-forward-100 bg-forward-50/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-forward-900">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] leading-snug text-forward-600">{detail}</p> : null}
    </div>
  );
}

/** Family Intelligence strip — Flow, Normal Life, Place & Drive KPIs under the map. */
export function FamilyIntelPanel({ state }: { state: FamilyMapState }) {
  const liveCount = state.members.filter((m) => m.lat != null && m.lng != null).length;
  const waitingCount = state.members.length - liveCount;
  const movers = state.members.filter(
    (m) => m.presence === "driving" || m.presence === "moving"
  ).length;

  const topPlace =
    state.places.find((p) => (p.membersHeadingThere ?? 0) > 0) ??
    state.places
      .filter((p) => p.insight)
      .sort((a, b) => b.visitCount - a.visitCount)[0] ??
    state.places.filter((p) => p.category !== "home").sort((a, b) => b.visitCount - a.visitCount)[0] ??
    state.places.sort((a, b) => b.visitCount - a.visitCount)[0] ??
    null;

  const latestTrip = state.recentTrips[0] ?? null;
  const predicted = state.members.find(
    (m) =>
      !m.isYou &&
      m.likelyDestination &&
      (m.destinationConfidence ?? 0) >= 0.65 &&
      (m.presence === "driving" || m.presence === "moving")
  );

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-forward-900">
            Family Intelligence
          </h3>
          <p className="mt-0.5 text-xs text-forward-500">
            Live household status — unusual routines surface here, not on the map chrome.
          </p>
        </div>
        <Brain className="mt-0.5 h-4 w-4 text-brand-blue" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          icon={<Activity className="h-3 w-3" />}
          label="Family Flow"
          value={state.flow.everyoneHomeByLabel ?? "Learning household flow…"}
          detail={
            waitingCount > 0
              ? `${liveCount} live · ${waitingCount} waiting on location`
              : movers > 0
                ? `${liveCount} live · ${movers} moving`
                : `${liveCount} people live on the map`
          }
        />
        <KpiCard
          icon={<Sparkles className="h-3 w-3" />}
          label="Something’s Different"
          value={
            state.somethingDifferent
              ? state.somethingDifferent.memberName
              : "All looks normal"
          }
          detail={
            state.somethingDifferent?.body ??
            "Routines look typical right now — unusual ≠ emergency."
          }
        />
        <KpiCard
          icon={<MapPinned className="h-3 w-3" />}
          label="Place Intel"
          value={
            topPlace
              ? topPlace.membersHeadingThere
                ? `${topPlace.name} · ${topPlace.membersHeadingThere} heading`
                : topPlace.visitCount > 0
                  ? topPlace.name
                  : "Save places on the map"
              : "Save places on the map"
          }
          detail={
            topPlace?.insight ??
            (topPlace && topPlace.visitCount > 0
              ? `${topPlace.visitCount} visits · avg ${topPlace.averageVisitMinutes} min`
              : "Tap the map to drop a pin and name Home, Work, School…")
          }
        />
        <KpiCard
          icon={<Car className="h-3 w-3" />}
          label="Drive Score"
          value={
            latestTrip
              ? `${latestTrip.driveScore}/100 · ${latestTrip.memberName ?? "Trip"}`
              : "No recent trip"
          }
          detail={
            latestTrip
              ? `${latestTrip.fromLabel} → ${latestTrip.toLabel} · max ${latestTrip.maxSpeedKmh} km/h`
              : "Drive Intelligence builds as family trips complete."
          }
        />
      </div>

      {state.flow.conflictNote || state.flow.opportunityNote || predicted ? (
        <ul className="mt-3 space-y-1.5 border-t border-forward-100 pt-3 text-xs text-forward-700">
          {state.flow.conflictNote ? (
            <li>
              <span className="font-semibold text-amber-800">Heads up.</span>{" "}
              {state.flow.conflictNote}
            </li>
          ) : null}
          {state.flow.opportunityNote ? (
            <li>
              <span className="font-semibold text-brand-blue">Note.</span>{" "}
              {state.flow.opportunityNote}
            </li>
          ) : null}
          {predicted ? (
            <li>
              <span className="font-semibold text-forward-900">Destination.</span>{" "}
              {predicted.displayName} likely → {predicted.likelyDestination}
              {predicted.destinationConfidence != null
                ? ` (${Math.round(predicted.destinationConfidence * 100)}%)`
                : ""}
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

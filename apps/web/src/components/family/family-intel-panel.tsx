"use client";

import { useState, type ReactNode } from "react";
import type { FamilyMapState } from "@forward/shared";
import { sanitizeSpeedKmh } from "@forward/shared";
import { Activity, Brain, Car, ChevronRight, MapPinned, Sparkles, X } from "lucide-react";

type KpiId = "flow" | "different" | "place" | "drive";

function KpiCard({
  icon,
  label,
  value,
  detail,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string | null;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? "border-brand-blue bg-sky-50/80 ring-1 ring-brand-blue/30"
          : "border-forward-100 bg-forward-50/60 hover:border-forward-300"
      }`}
      aria-expanded={active}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
          {icon}
          {label}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-forward-400" />
      </div>
      <p className="mt-1 text-sm font-semibold text-forward-900">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] leading-snug text-forward-600">{detail}</p> : null}
    </button>
  );
}

/** Family Intelligence strip — Flow, Normal Life, Place & Drive KPIs (tap for detail). */
export function FamilyIntelPanel({ state }: { state: FamilyMapState }) {
  const [open, setOpen] = useState<KpiId | null>(null);

  const liveCount = state.members.filter((m) => m.lat != null && m.lng != null).length;
  const waitingCount = state.members.length - liveCount;
  const movers = state.members.filter(
    (m) => m.presence === "driving" || m.presence === "moving"
  ).length;
  const atHome = state.members.filter(
    (m) => m.placeCategory === "home" || /home/i.test(m.placeName ?? "")
  );

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

  const safeMax =
    latestTrip != null ? Math.round(sanitizeSpeedKmh(latestTrip.maxSpeedKmh) ?? 0) : 0;

  const detailBody = (() => {
    if (open === "flow") {
      return {
        title: "Family Flow",
        body:
          state.flow.everyoneHomeByLabel ??
          "We’re still learning when everyone is usually home.",
        bullets: [
          `${liveCount} people live on the map${waitingCount ? ` · ${waitingCount} waiting on location` : ""}`,
          movers > 0
            ? `${movers} currently moving or driving`
            : "Nobody is in motion right now",
          atHome.length
            ? `At home now: ${atHome.map((m) => m.displayName).join(", ")}`
            : "No one tagged at Home right now",
          state.flow.conflictNote
            ? `Heads up: ${state.flow.conflictNote}`
            : "No schedule conflicts flagged",
          state.flow.opportunityNote
            ? `Note: ${state.flow.opportunityNote}`
            : null,
        ].filter(Boolean) as string[],
      };
    }
    if (open === "different") {
      const sd = state.somethingDifferent;
      return {
        title: "Something’s Different",
        body: sd
          ? `${sd.memberName} — ${sd.title}`
          : "All looks normal for this household’s usual routines.",
        bullets: [
          sd?.body ??
            "Unusual ≠ emergency. We only surface patterns that look off compared with each person’s Normal Life model.",
          "Examples: still at work much later than usual, or a place stay that doesn’t match the weekday pattern.",
          "Tap the person on the map for live status, or open history when you want the full day.",
        ],
      };
    }
    if (open === "place") {
      return {
        title: "Place Intel",
        body: topPlace
          ? topPlace.name
          : "Save Home, Work, and School on the map to unlock place intelligence.",
        bullets: topPlace
          ? [
              topPlace.insight ??
                `${topPlace.visitCount} visits · avg ${topPlace.averageVisitMinutes} min stay`,
              topPlace.membersHeadingThere
                ? `${topPlace.membersHeadingThere} heading there now`
                : "Nobody heading there right now",
              topPlace.mostCommonVisitorName
                ? `Most common visitor: ${topPlace.mostCommonVisitorName}`
                : "Visitor patterns build as the family shares live location",
              "Place alerts (arrive / leave) and No Show Alerts live on each member’s sheet.",
            ]
          : [
              "Tap the map to drop a pin, name it, and choose Home / Work / School.",
              "Once saved, we learn visit patterns and can alert on arrivals and departures.",
            ],
      };
    }
    if (open === "drive") {
      return {
        title: "Drive Score",
        body: latestTrip
          ? `${latestTrip.driveScore}/100 · ${latestTrip.memberName ?? "Trip"}`
          : "No recent completed trip yet.",
        bullets: latestTrip
          ? [
              `${latestTrip.fromLabel} → ${latestTrip.toLabel}`,
              `Distance ${latestTrip.distanceKm} km · ${latestTrip.durationMinutes} min`,
              `Top speed ${safeMax > 0 ? `${safeMax} km/h` : "—"} (GPS glitches filtered)`,
              `Hard brakes ${latestTrip.hardBraking} · Rapid accel ${latestTrip.rapidAcceleration} · Unusual ${latestTrip.unusualRouteEvents}`,
              "Score starts at 100 and drops for hard brakes, rapid accel, unusual stops, and very high speed. Tap Weekly Driving Report for the household view.",
            ]
          : [
              "Keep Share live on during drives — score and events build when trips complete.",
              "Hard braking, rapid acceleration, and unusual stops are explained in the Weekly Driving Report event mix.",
            ],
      };
    }
    return null;
  })();

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-forward-900">
            Family Intelligence
          </h3>
          <p className="mt-0.5 text-xs text-forward-500">
            Tap a card for the full story — unusual routines surface here, not on the map chrome.
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
          active={open === "flow"}
          onClick={() => setOpen((v) => (v === "flow" ? null : "flow"))}
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
          active={open === "different"}
          onClick={() => setOpen((v) => (v === "different" ? null : "different"))}
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
          active={open === "place"}
          onClick={() => setOpen((v) => (v === "place" ? null : "place"))}
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
              ? `${latestTrip.fromLabel} → ${latestTrip.toLabel} · max ${
                  safeMax > 0 ? `${safeMax} km/h` : "—"
                }`
              : "Drive Intelligence builds as family trips complete."
          }
          active={open === "drive"}
          onClick={() => setOpen((v) => (v === "drive" ? null : "drive"))}
        />
      </div>

      {detailBody ? (
        <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-sm font-semibold text-forward-900">
              {detailBody.title}
            </p>
            <button
              type="button"
              className="rounded-full bg-white p-1 text-forward-600 shadow-sm"
              aria-label="Close details"
              onClick={() => setOpen(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-forward-800">{detailBody.body}</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-snug text-forward-700">
            {detailBody.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-blue" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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

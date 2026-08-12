"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FamilyMapState } from "@forward/shared";
import { sanitizeSpeedKmh } from "@forward/shared";
import {
  Activity,
  Brain,
  Car,
  ChevronRight,
  Clock3,
  Fuel,
  Home,
  MapPinned,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { buildFamilyLifeBrief } from "@/lib/family-map/life-brief";
import { isHouseholdHomePlace } from "@/lib/family-map/member-presence-label";

type KpiId =
  | "flow"
  | "different"
  | "place"
  | "drive"
  | "fuel"
  | "shopping"
  | "departure"
  | "familyTime";

type KpiTone =
  | "flow"
  | "different"
  | "place"
  | "drive"
  | "fuel"
  | "shopping"
  | "departure"
  | "familyTime";

function KpiCard({
  icon,
  label,
  value,
  detail,
  tone,
  flagged,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string | null;
  tone: KpiTone;
  flagged?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`family-intel-kpi family-intel-kpi--${tone}${
        flagged ? " is-flagged" : ""
      }${active ? " is-active" : ""}`}
      aria-expanded={active}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="family-intel-kpi__label">
          {icon}
          {label}
        </div>
        <ChevronRight className="h-3.5 w-3.5 opacity-70" />
      </div>
      <p className="family-intel-kpi__value">{value}</p>
      {detail ? <p className="family-intel-kpi__detail">{detail}</p> : null}
    </button>
  );
}

/** Family Intelligence — life brief + Flow / Drive / Fuel / Visits / Shopping. */
export function FamilyIntelPanel({ state }: { state: FamilyMapState }) {
  const [open, setOpen] = useState<KpiId | null>(null);
  const brief = useMemo(() => buildFamilyLifeBrief(state), [state]);

  const liveCount = state.members.filter((m) => m.lat != null && m.lng != null).length;
  const waitingCount = state.members.length - liveCount;
  const movers = state.members.filter(
    (m) => m.presence === "driving" || m.presence === "moving"
  ).length;
  const atHome = state.members.filter((m) => isHouseholdHomePlace(m));

  const topPlace =
    state.places.find((p) => (p.membersHeadingThere ?? 0) > 0) ??
    state.places
      .filter((p) => p.insight)
      .sort((a, b) => b.visitCount - a.visitCount)[0] ??
    state.places.filter((p) => p.category !== "home").sort((a, b) => b.visitCount - a.visitCount)[0] ??
    state.places.sort((a, b) => b.visitCount - a.visitCount)[0] ??
    null;

  const latestTrip = state.recentTrips[0] ?? null;
  const visits = state.placeVisitsToday ?? [];
  const fuel = state.you.fuelSummary;
  const shopPlaces = state.places.filter((p) => p.category === "shop");
  const shopVisits = visits.filter(
    (v) =>
      shopPlaces.some((p) => p.name.toLowerCase() === v.placeName.toLowerCase()) ||
      /\b(costco|walmart|loblaws|metro|sobeys|shop|mall|grocery|superstore)\b/i.test(
        v.placeName
      )
  );
  const predicted = state.members.find(
    (m) =>
      !m.isYou &&
      m.likelyDestination &&
      (m.destinationConfidence ?? 0) >= 0.65 &&
      (m.presence === "driving" || m.presence === "moving")
  );

  const safeMax =
    latestTrip != null ? Math.round(sanitizeSpeedKmh(latestTrip.maxSpeedKmh) ?? 0) : 0;

  const hard = state.recentTrips.reduce((a, t) => a + t.hardBraking, 0);
  const accel = state.recentTrips.reduce((a, t) => a + t.rapidAcceleration, 0);
  const unusual = state.recentTrips.reduce((a, t) => a + t.unusualRouteEvents, 0);
  const km = state.recentTrips.reduce((a, t) => a + t.distanceKm, 0);

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
          state.flow.opportunityNote ? `Note: ${state.flow.opportunityNote}` : null,
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
              visits.length
                ? `Today: ${visits.length} visit${visits.length === 1 ? "" : "s"} logged for you`
                : "No visits logged for you yet today",
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
        title: "Driving habits",
        body: latestTrip
          ? `${latestTrip.driveScore}/100 · ${latestTrip.memberName ?? "Trip"}`
          : "No recent completed trip yet.",
        bullets: latestTrip
          ? [
              `${latestTrip.fromLabel} → ${latestTrip.toLabel}`,
              `Recent trips: ${state.recentTrips.length} · ${km.toFixed(1)} km total`,
              `Top speed ${safeMax > 0 ? `${safeMax} km/h` : "—"} (GPS glitches filtered)`,
              `Hard brakes ${hard} · Rapid accel ${accel} · Unusual ${unusual}`,
              "Score starts at 100 and drops for hard brakes, rapid accel, unusual stops, and very high speed. Open Weekly Driving Report for the household mix.",
            ]
          : [
              "Keep Share live on during drives — score and events build when trips complete.",
              "Hard braking, rapid acceleration, and unusual stops show in the Weekly Driving Report.",
            ],
      };
    }
    if (open === "fuel") {
      return {
        title: "Fuel & energy",
        body: state.you.vehicle
          ? state.you.vehicle.engineSummary
          : "Add your vehicle in Family settings to estimate fuel cost.",
        bullets: [
          fuel.tripCount > 0
            ? `$${fuel.monthCad.toFixed(2)} this month · ${fuel.tripCount} trip${
                fuel.tripCount === 1 ? "" : "s"
              }`
            : state.you.vehicle
              ? "Vehicle saved — finish a drive with Share Live on to log cost"
              : "No fuel-costed trips yet this month",
          fuel.prevMonthCad > 0
            ? `Last month $${fuel.prevMonthCad.toFixed(2)} (${fuel.direction})`
            : fuel.tripCount > 0
              ? "Previous month: none yet"
              : "Costs backfill from saved vehicle + completed drive distance",
          state.you.vehicle?.litresPer100km != null
            ? `Economy ~${state.you.vehicle.litresPer100km} L/100 km`
            : state.you.vehicle?.kwhPer100km != null
              ? `Economy ~${state.you.vehicle.kwhPer100km} kWh/100 km`
              : "Economy estimate comes from make/model",
          "Per-trip fuel cost appears on completed drives once a vehicle is saved.",
        ],
      };
    }
    if (open === "shopping") {
      return {
        title: "Shopping & visits",
        body:
          shopVisits.length > 0
            ? `${shopVisits.length} shopping stop${shopVisits.length === 1 ? "" : "s"} today`
            : visits.length > 0
              ? `${visits.length} place visit${visits.length === 1 ? "" : "s"} today`
              : "No shopping stops logged yet today.",
        bullets: [
          ...(shopVisits.length
            ? [...new Set(shopVisits.map((v) => v.placeName))]
                .slice(0, 4)
                .map((name) => `Shop: ${name}`)
            : ["Mark places as Shop on the map to sharpen shopping intel."]),
          visits.length
            ? `All visits today: ${[...new Set(visits.map((v) => v.placeName))]
                .slice(0, 5)
                .join(", ")}`
            : "Visits appear when someone stays at a named place.",
          shopPlaces.length
            ? `Saved shops: ${shopPlaces.map((p) => p.name).slice(0, 4).join(", ")}`
            : "Tap the map → save a pin → category Shop.",
        ],
      };
    }
    if (open === "departure") {
      const sd = state.smartDeparture;
      return {
        title: "Smart Departure",
        body: sd
          ? sd.leaveByLabel
          : "Save Home or Work on the map to get leave-by times. Calendar is optional.",
        bullets: sd
          ? [
              `Destination: ${sd.destinationName}`,
              sd.etaMinutes > 0
                ? `Arrive by ~${sd.arriveByLabel} · ${sd.etaMinutes} min drive`
                : "No drive needed right now",
              sd.trafficBufferMin > 0
                ? `Includes +${sd.trafficBufferMin} min traffic buffer`
                : "No extra traffic buffer right now",
              sd.rationale,
            ]
          : [
              "We match your next calendar event to a saved place when connected.",
              "Without a calendar we still suggest leave-by using Home / Work / School.",
            ],
      };
    }
    if (open === "familyTime") {
      const ft = state.familyTime;
      return {
        title: "Family Time Intelligence",
        body:
          ft?.insight ??
          "Save a Home place and keep Share Live on — home hours and commute averages fill in from real stays.",
        bullets: ft
          ? [
              `Commute ~${ft.commuteMinPerDay} min/day this week`,
              ft.commuteDeltaMinPerDay != null
                ? `Change vs last week: ${ft.commuteDeltaMinPerDay > 0 ? "+" : ""}${ft.commuteDeltaMinPerDay} min/day`
                : "Need another week of trips to compare",
              `Time at home: ~${ft.familyHomeHoursWeek} hrs this week`,
              "This is your private signal — not shared with the household.",
            ]
          : [
              "Save Home (category Home) on the map.",
              "Completed drives and Home stays unlock commute vs family-time insight.",
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
          <p className="mt-0.5 text-xs text-forward-500">{brief.summary}</p>
        </div>
        <Brain className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {brief.chips.map((chip) => (
          <div
            key={chip.label}
            className={`family-intel-chip family-intel-chip--${
              chip.tone === "good"
                ? "good"
                : chip.tone === "watch"
                  ? "watch"
                  : "neutral"
            }`}
          >
            <p className="family-intel-chip__label">{chip.label}</p>
            <p className="family-intel-chip__value">{chip.value}</p>
          </div>
        ))}
      </div>

      {brief.insights.length ? (
        <ul className="mt-3 space-y-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-medium leading-snug text-sky-950">
          {brief.insights.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <KpiCard
          tone="flow"
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Family Flow"
          value={state.flow.everyoneHomeByLabel ?? "Learning…"}
          detail={
            movers > 0 ? `${movers} moving` : `${liveCount} live on map`
          }
          active={open === "flow"}
          onClick={() => setOpen((v) => (v === "flow" ? null : "flow"))}
        />
        <KpiCard
          tone="different"
          flagged={Boolean(state.somethingDifferent)}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Different"
          value={
            state.somethingDifferent
              ? state.somethingDifferent.memberName
              : "All normal"
          }
          detail={state.somethingDifferent?.title ?? "Routines look typical"}
          active={open === "different"}
          onClick={() => setOpen((v) => (v === "different" ? null : "different"))}
        />
        <KpiCard
          tone="place"
          icon={<MapPinned className="h-3.5 w-3.5" />}
          label="Places"
          value={
            visits.length > 0
              ? `${visits.length} today`
              : topPlace?.name ?? "Save places"
          }
          detail={
            topPlace?.insight ??
            (topPlace ? `${topPlace.visitCount} lifetime visits` : "Drop a pin on the map")
          }
          active={open === "place"}
          onClick={() => setOpen((v) => (v === "place" ? null : "place"))}
        />
        <KpiCard
          tone="drive"
          icon={<Car className="h-3.5 w-3.5" />}
          label="Driving"
          value={
            latestTrip
              ? `${latestTrip.driveScore}/100`
              : "No trip yet"
          }
          detail={
            latestTrip
              ? `Max ${safeMax || "—"} km/h · see Weekly report`
              : "Builds on completed drives"
          }
          active={open === "drive"}
          onClick={() => setOpen((v) => (v === "drive" ? null : "drive"))}
        />
        <KpiCard
          tone="fuel"
          icon={<Fuel className="h-3.5 w-3.5" />}
          label="Fuel"
          value={
            fuel.tripCount > 0
              ? `$${fuel.monthCad.toFixed(2)}`
              : state.you.vehicle
                ? "$0.00"
                : "Add vehicle"
          }
          detail={
            fuel.tripCount > 0
              ? state.you.vehicle?.engineSummary ?? `${fuel.tripCount} trips this month`
              : state.you.vehicle
                ? "Vehicle saved · costs appear on completed drives"
                : "Family settings → Your vehicle"
          }
          active={open === "fuel"}
          onClick={() => setOpen((v) => (v === "fuel" ? null : "fuel"))}
        />
        <KpiCard
          tone="shopping"
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          label="Shopping"
          value={
            shopVisits.length > 0
              ? `${shopVisits.length} today`
              : shopPlaces.length > 0
                ? `${shopPlaces.length} saved`
                : "None yet"
          }
          detail={
            shopVisits[0]?.placeName ??
            shopPlaces[0]?.name ??
            "Save shops on the map"
          }
          active={open === "shopping"}
          onClick={() => setOpen((v) => (v === "shopping" ? null : "shopping"))}
        />
        <KpiCard
          tone="departure"
          icon={<Clock3 className="h-3.5 w-3.5" />}
          label="Leave by"
          value={state.smartDeparture?.leaveByLabel ?? "Save a place"}
          detail={
            state.smartDeparture
              ? state.smartDeparture.etaMinutes > 0
                ? `${state.smartDeparture.destinationName} · ${state.smartDeparture.etaMinutes} min`
                : state.smartDeparture.rationale
              : "Save Home / Work on the map"
          }
          active={open === "departure"}
          onClick={() => setOpen((v) => (v === "departure" ? null : "departure"))}
        />
        <KpiCard
          tone="familyTime"
          icon={<Home className="h-3.5 w-3.5" />}
          label="Family time"
          value={
            state.familyTime
              ? `${state.familyTime.familyHomeHoursWeek}h home`
              : "Save Home"
          }
          detail={
            state.familyTime
              ? state.familyTime.commuteMinPerDay > 0
                ? `Commute ~${state.familyTime.commuteMinPerDay} min/day`
                : state.familyTime.insight
              : "Save Home + keep Share Live on"
          }
          active={open === "familyTime"}
          onClick={() => setOpen((v) => (v === "familyTime" ? null : "familyTime"))}
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

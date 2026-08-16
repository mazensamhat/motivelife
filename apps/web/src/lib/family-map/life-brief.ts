/**
 * Build a short Family Life brief from live map state — driving, fuel, visits, shopping.
 * Pure + sync so the map panel can render it without another round-trip.
 */

import type { FamilyMapState } from "@forward/shared";
import { sanitizeSpeedKmh } from "@forward/shared";
import { isWorkoutPlace } from "./workout-presence";

export type FamilyLifeBrief = {
  headline: string;
  summary: string;
  chips: Array<{ label: string; value: string; tone: "neutral" | "good" | "watch" }>;
  insights: string[];
  avgDriveScore: number | null;
};

export function buildFamilyLifeBrief(state: FamilyMapState): FamilyLifeBrief {
  const trips = state.recentTrips ?? [];
  const visits = state.placeVisitsToday ?? [];
  const fuel = state.you.fuelSummary;
  const places = state.places ?? [];

  const shopPlaces = new Set(
    places.filter((p) => p.category === "shop").map((p) => p.name.toLowerCase())
  );
  const shopVisits = visits.filter(
    (v) =>
      shopPlaces.has(v.placeName.toLowerCase()) ||
      /\b(costco|walmart|loblaws|metro|sobeys|shop|mall|grocery|superstore)\b/i.test(
        v.placeName
      )
  );

  const phone = trips.reduce((a, t) => a + (t.phoneUsageEvents ?? 0), 0);
  const km = trips.reduce((a, t) => a + t.distanceKm, 0);
  const fuelTripCad = trips.reduce((a, t) => a + (t.estimatedFuelCostCad ?? 0), 0);
  const scores = trips.map((t) => t.driveScore).filter((n) => Number.isFinite(n));
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  const topSpeed = Math.max(
    0,
    ...trips.map((t) => Math.round(sanitizeSpeedKmh(t.maxSpeedKmh) ?? 0))
  );

  const activeVisits = visits.filter((v) => v.isActive);
  const movers = state.members.filter(
    (m) => m.presence === "driving" || m.presence === "moving"
  );

  const chips: FamilyLifeBrief["chips"] = [
    {
      label: "Drive score",
      value:
        avgScore != null
          ? `${avgScore}/100`
          : trips.length === 0
            ? "After next trip"
            : "Scoring…",
      tone:
        avgScore == null ? "neutral" : avgScore >= 85 ? "good" : avgScore >= 70 ? "neutral" : "watch",
    },
    {
      label: "Fuel (month)",
      value:
        fuel.tripCount > 0
          ? `$${fuel.monthCad.toFixed(2)}`
          : fuelTripCad > 0
            ? `~$${fuelTripCad.toFixed(2)} recent`
            : state.you.vehicle
              ? "Ready · $0"
              : "Add vehicle",
      tone: fuel.direction === "up" ? "watch" : fuel.direction === "down" ? "good" : "neutral",
    },
    {
      label: "Visits today",
      value:
        visits.length > 0
          ? `${visits.length} place${visits.length === 1 ? "" : "s"}`
          : "None yet",
      tone: visits.length > 0 ? "good" : "neutral",
    },
    {
      label: "Shopping",
      value:
        shopVisits.length > 0
          ? `${shopVisits.length} stop${shopVisits.length === 1 ? "" : "s"}`
          : "Quiet day",
      tone: shopVisits.length > 0 ? "good" : "neutral",
    },
  ];

  const insights: string[] = [];

  if (state.flow.everyoneHomeByLabel) {
    insights.push(state.flow.everyoneHomeByLabel);
  }
  const leaveSooners = state.members
    .filter(
      (m) =>
        m.presence === "stationary" &&
        m.leaveInMinutes != null &&
        m.leaveInMinutes >= 0 &&
        m.leaveInMinutes <= 90 &&
        m.placeName
    )
    .sort((a, b) => (a.leaveInMinutes ?? 99) - (b.leaveInMinutes ?? 99));
  if (leaveSooners[0]) {
    const m = leaveSooners[0];
    const first = m.displayName.split(" ")[0] || m.displayName;
    insights.push(
      m.leaveInMinutes! <= 1
        ? `${first} usually leaves ${m.placeName} now`
        : `${first} usually leaves ${m.placeName} in ~${m.leaveInMinutes} min`
    );
  }
  const predicted = movers.find(
    (m) =>
      m.likelyDestination &&
      (m.destinationConfidence ?? 0) >= 0.36
  );
  if (predicted?.likelyDestination) {
    const pct = Math.round((predicted.destinationConfidence ?? 0) * 100);
    insights.push(
      `${predicted.displayName.split(" ")[0]} likely heading ${predicted.likelyDestination}${
        pct >= 36 ? ` · ${pct}%` : ""
      }${
        predicted.etaMinutes != null ? ` · ETA ${predicted.etaMinutes} min` : ""
      }`
    );
  }
  if (state.areaIntel?.driveImpact?.headline) {
    insights.push(
      `${state.areaIntel.driveImpact.headline}${
        state.areaIntel.driveImpact.etaDeltaMin > 0
          ? ` · +${state.areaIntel.driveImpact.etaDeltaMin} min`
          : ""
      }`
    );
  }
  if (movers.length) {
    const workoutMovers = movers.filter((m) =>
      isWorkoutPlace({ placeName: m.placeName, placeCategory: m.placeCategory })
    );
    if (workoutMovers.length) {
      insights.push(
        `${workoutMovers
          .map((m) => {
            const first = m.displayName.split(/\s+/)[0] ?? m.displayName;
            const where = m.placeName ?? "the park";
            return `${first} working out at ${where}`;
          })
          .slice(0, 2)
          .join("; ")}`
      );
    } else {
      insights.push(
        `${movers.map((m) => m.displayName).slice(0, 2).join(", ")}${
          movers.length > 2 ? ` +${movers.length - 2}` : ""
        } on the move${
          movers[0]?.speedKmh != null ? ` · ${Math.round(movers[0].speedKmh)} km/h` : ""
        }`
      );
    }
  }
  if (trips.length) {
    const habitBits = [
      km > 0 ? `${km.toFixed(1)} km recent` : null,
      phone > 0
        ? `phone in use ${phone}× while driving`
        : "no phone-in-use ticks",
      topSpeed > 0 ? `top ${topSpeed} km/h` : null,
    ].filter(Boolean);
    insights.push(`Driving habits: ${habitBits.join(" · ")}`);
  } else {
    insights.push("Driving habits build after completed trips with Share live on.");
  }

  if (fuel.tripCount > 0) {
    const trend =
      fuel.direction === "up"
        ? "up vs last month"
        : fuel.direction === "down"
          ? "down vs last month"
          : "steady vs last month";
    insights.push(
      `Fuel ${trend}: $${fuel.monthCad.toFixed(2)} this month across ${fuel.tripCount} trip${
        fuel.tripCount === 1 ? "" : "s"
      }.${state.you.vehicle ? ` Vehicle: ${state.you.vehicle.engineSummary}.` : ""}`
    );
  } else if (fuelTripCad > 0) {
    insights.push(
      `About $${fuelTripCad.toFixed(2)} fuel on recent drives${
        state.you.vehicle ? ` · ${state.you.vehicle.engineSummary}` : ""
      }.`
    );
  } else if (state.you.vehicle) {
    insights.push(
      `Vehicle saved (${state.you.vehicle.engineSummary}). Fuel $ appears after the next completed drive with Share Live on.`
    );
  } else {
    insights.push("Add your vehicle in Family settings to estimate fuel / energy cost per drive.");
  }

  if (visits.length) {
    const names = [...new Set(visits.map((v) => v.placeName))].slice(0, 4);
    insights.push(
      `Today’s places: ${names.join(", ")}${
        visits.length > names.length ? "…" : ""
      }${activeVisits.length ? ` · ${activeVisits.length} still there` : ""}`
    );
  } else {
    insights.push("No place visits logged today yet — stays appear when someone settles at a saved place.");
  }

  if (shopVisits.length) {
    const shops = [...new Set(shopVisits.map((v) => v.placeName))].slice(0, 3);
    insights.push(`Shopping pattern: ${shops.join(", ")}.`);
  }

  if (state.somethingDifferent) {
    const conf = state.somethingDifferent.confidenceLabel
      ? ` (${state.somethingDifferent.confidenceLabel})`
      : "";
    insights.push(
      `Something’s different: ${state.somethingDifferent.memberName} — ${state.somethingDifferent.body}${conf}`
    );
  }

  const normals = (state.normalLife ?? []).filter((n) => n.status !== "learning" || n.sampleCount > 0);
  for (const n of normals.slice(0, 3)) {
    if (n.status === "unusual") continue; // already covered by Something’s Different
    insights.push(`${n.displayName.split(" ")[0]}’s normal: ${n.line}`);
  }
  if (state.flow.conflictNote) insights.push(`Heads up: ${state.flow.conflictNote}`);
  if (state.flow.opportunityNote) insights.push(state.flow.opportunityNote);
  if (state.smartDeparture) {
    insights.push(
      `Smart Departure: ${state.smartDeparture.leaveByLabel} for ${state.smartDeparture.destinationName}`
    );
  }
  if (state.familyTime?.insight) {
    insights.push(state.familyTime.insight);
  }

  const headline =
    avgScore != null
      ? `Household Drive Score ${avgScore}`
      : state.flow.everyoneHomeByLabel ?? "Family Life brief";

  const summary =
    trips.length || visits.length || fuel.tripCount
      ? [
          trips.length ? `${trips.length} recent drive${trips.length === 1 ? "" : "s"}` : null,
          visits.length ? `${visits.length} place visit${visits.length === 1 ? "" : "s"} today` : null,
          fuel.tripCount > 0 ? `$${fuel.monthCad.toFixed(2)} fuel this month` : null,
          state.familyTime?.insight ? "family time tracked" : null,
        ]
          .filter(Boolean)
          .join(" · ") ||
        "Live map plus what the household’s movement is teaching us."
      : "Keep Share Live on — Drive Score, fuel, visits, and leave-by times fill in as people move.";

  return { headline, summary, chips, insights: insights.slice(0, 8), avgDriveScore: avgScore };
}

/**
 * Build a short Family Life brief from live map state — driving, fuel, visits, shopping.
 * Pure + sync so the map panel can render it without another round-trip.
 */

import type { FamilyMapState } from "@forward/shared";
import { sanitizeSpeedKmh } from "@forward/shared";

export type FamilyLifeBrief = {
  headline: string;
  summary: string;
  chips: Array<{ label: string; value: string; tone: "neutral" | "good" | "watch" }>;
  insights: string[];
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

  const hard = trips.reduce((a, t) => a + t.hardBraking, 0);
  const accel = trips.reduce((a, t) => a + t.rapidAcceleration, 0);
  const unusual = trips.reduce((a, t) => a + t.unusualRouteEvents, 0);
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
      value: avgScore != null ? `${avgScore}/100` : "Learning…",
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
              ? "Tracking…"
              : "Add vehicle",
      tone: fuel.direction === "up" ? "watch" : fuel.direction === "down" ? "good" : "neutral",
    },
    {
      label: "Visits today",
      value: `${visits.length}`,
      tone: "neutral",
    },
    {
      label: "Shopping",
      value: shopVisits.length > 0 ? `${shopVisits.length} stop${shopVisits.length === 1 ? "" : "s"}` : "None yet",
      tone: "neutral",
    },
  ];

  const insights: string[] = [];

  if (state.flow.everyoneHomeByLabel) {
    insights.push(state.flow.everyoneHomeByLabel);
  }
  if (movers.length) {
    insights.push(
      `${movers.map((m) => m.displayName).slice(0, 2).join(", ")}${
        movers.length > 2 ? ` +${movers.length - 2}` : ""
      } on the move${
        movers[0]?.speedKmh != null ? ` · ${Math.round(movers[0].speedKmh)} km/h` : ""
      }`
    );
  }
  if (trips.length) {
    const habitBits = [
      km > 0 ? `${km.toFixed(1)} km recent` : null,
      hard > 0 ? `${hard} hard brake${hard === 1 ? "" : "s"}` : "smooth braking",
      accel > 0 ? `${accel} rapid accel` : null,
      unusual > 0 ? `${unusual} unusual stop${unusual === 1 ? "" : "s"}` : null,
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
  } else if (!state.you.vehicle) {
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
    insights.push(
      `Something’s different: ${state.somethingDifferent.memberName} — ${state.somethingDifferent.title}`
    );
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
      ? "Live map plus what the household’s movement is teaching us — driving, fuel, visits, logistics, and family time."
      : "Keep Share live on. Drive Score, fuel, visits, and shopping insights fill in as the family moves.";

  return { headline, summary, chips, insights: insights.slice(0, 8) };
}

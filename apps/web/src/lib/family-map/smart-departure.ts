/**
 * Smart Departure™ — recommend when the viewer should leave.
 * Uses calendar (when connected), saved places, ETA math, and traffic buffer.
 * Does not rebuild Destination Prediction — reuses the same urban ETA model.
 */

import {
  formatEtaClock,
  haversineKm,
  type FamilyPlaceCategory,
  type FamilySmartDeparture,
} from "@forward/shared";

export type SmartDeparturePlace = {
  name: string;
  lat: number;
  lng: number;
  category: FamilyPlaceCategory | string;
};

export type SmartDepartureEvent = {
  title: string;
  start: Date;
};

function urbanEtaMinutes(distKm: number, speedKmh: number | null | undefined) {
  const urbanKmh = Math.max(22, Math.min(70, speedKmh && speedKmh > 8 ? speedKmh : 42));
  return Math.max(1, Math.round((distKm / urbanKmh) * 60));
}

function namesOverlap(a: string, b: string) {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function pickDestination(opts: {
  now: Date;
  events: SmartDepartureEvent[];
  places: SmartDeparturePlace[];
}): { place: SmartDeparturePlace; reason: string; arriveBy: Date } | null {
  const upcoming = [...opts.events]
    .filter((e) => e.start.getTime() > opts.now.getTime() - 5 * 60_000)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const event of upcoming.slice(0, 6)) {
    const matched = opts.places.find((p) => namesOverlap(event.title, p.name));
    if (matched) {
      return {
        place: matched,
        reason: `Calendar: ${event.title}`,
        arriveBy: event.start,
      };
    }
  }

  // Time-of-day priors when calendar has no place match
  const hour = opts.now.getHours();
  const prefer =
    hour >= 6 && hour <= 10
      ? ["work", "school"]
      : hour >= 14 && hour <= 19
        ? ["school", "sports", "home"]
        : ["home", "work"];

  for (const cat of prefer) {
    const place = opts.places.find((p) => p.category === cat);
    if (!place) continue;
    // Default arrive window: 45 minutes from now for soft targets
    const arriveBy = new Date(opts.now.getTime() + 45 * 60_000);
    return {
      place,
      reason: `Usual ${cat} destination`,
      arriveBy,
    };
  }

  return null;
}

export function buildSmartDeparture(opts: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  speedKmh?: number | null;
  places: SmartDeparturePlace[];
  events?: SmartDepartureEvent[];
  trafficLevel?: string | null;
  usualLeaveMinute?: number | null;
  now?: Date;
}): FamilySmartDeparture | null {
  if (opts.lat == null || opts.lng == null) return null;
  if (!opts.places.length) return null;

  const now = opts.now ?? new Date();
  const picked = pickDestination({
    now,
    events: opts.events ?? [],
    places: opts.places,
  });
  if (!picked) return null;

  // Already at the destination — nothing to leave for
  const distKm = haversineKm(opts.lat, opts.lng, picked.place.lat, picked.place.lng);
  if (distKm < 0.12) return null;

  const etaMinutes = urbanEtaMinutes(distKm, opts.speedKmh);
  const trafficBufferMin = opts.trafficLevel === "slow" ? 8 : opts.trafficLevel === "moderate" ? 4 : 0;

  let leaveIn = Math.max(
    0,
    Math.round((picked.arriveBy.getTime() - now.getTime()) / 60_000) - etaMinutes - trafficBufferMin
  );

  // Routine nudge: if we usually leave around usualLeaveMinute and that's sooner
  if (opts.usualLeaveMinute != null && Number.isFinite(opts.usualLeaveMinute)) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const routineLeaveIn = opts.usualLeaveMinute - nowMin;
    if (routineLeaveIn >= 0 && routineLeaveIn < leaveIn) {
      leaveIn = routineLeaveIn;
    }
  }

  // If arriveBy is a soft prior (no calendar) and leaveIn is huge, clamp to "leave soon"
  if (leaveIn > 90 && !(opts.events ?? []).length) {
    leaveIn = Math.min(leaveIn, 25);
  }

  // Too late already — still show arrive/ETA so the user can act
  const leaveByLabel =
    leaveIn <= 0
      ? "Leave now"
      : `Leave by ${formatEtaClock(now, leaveIn)}`;

  const bits = [
    picked.reason,
    `${etaMinutes} min drive`,
    trafficBufferMin > 0 ? `+${trafficBufferMin} min traffic buffer` : null,
    opts.usualLeaveMinute != null ? "routine leave window" : null,
  ].filter(Boolean);

  return {
    leaveByLabel,
    arriveByLabel: formatEtaClock(
      now,
      Math.max(etaMinutes + trafficBufferMin, leaveIn + etaMinutes + trafficBufferMin)
    ),
    destinationName: picked.place.name,
    etaMinutes,
    trafficBufferMin,
    rationale: bits.join(" · "),
  };
}

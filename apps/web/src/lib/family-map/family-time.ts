/**
 * Family Time Intelligence™ — how commute load trades against time at home.
 * Viewer-scoped from own trips + home place visits.
 */

import type { DriveTripSummary, FamilyPlaceVisitView, FamilyTimeIntel } from "@forward/shared";

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function isCommuteTrip(t: DriveTripSummary) {
  const from = t.fromLabel.toLowerCase();
  const to = t.toLabel.toLowerCase();
  return (
    /\b(home|work|school|office)\b/.test(from) ||
    /\b(home|work|school|office)\b/.test(to) ||
    // Any completed drive over 1 km still counts toward commute load when
    // labels are reverse-geocode streets (common on iOS BG trips).
    (t.distanceKm >= 1.2 && t.durationMinutes >= 4)
  );
}

function namesMatchHome(placeName: string, homeNames: Set<string>) {
  const n = placeName.trim().toLowerCase();
  if (!n) return false;
  if (homeNames.has(n)) return true;
  for (const h of homeNames) {
    if (n === h || n.includes(h) || h.includes(n)) return true;
  }
  // Unsaved "Home" / category-style labels
  return /\bhome\b/.test(n);
}

function homeMinutes(visits: FamilyPlaceVisitView[], homeNames: Set<string>) {
  let minutes = 0;
  for (const v of visits) {
    if (!namesMatchHome(v.placeName, homeNames)) continue;
    if (v.dwellMinutes != null && v.dwellMinutes > 0 && !v.isActive) {
      minutes += v.dwellMinutes;
      continue;
    }
    const arrived = new Date(v.arrivedAt);
    const end = v.departedAt ? new Date(v.departedAt) : new Date();
    if (end.getTime() > arrived.getTime()) {
      minutes += Math.round((end.getTime() - arrived.getTime()) / 60_000);
    }
  }
  return minutes;
}

function eveningHomeMinutes(visits: FamilyPlaceVisitView[], homeNames: Set<string>) {
  let minutes = 0;
  for (const v of visits) {
    if (!namesMatchHome(v.placeName, homeNames)) continue;
    const arrived = new Date(v.arrivedAt);
    const end = v.departedAt ? new Date(v.departedAt) : new Date();
    // Count overlap with 5pm–10pm local as "family evening"
    const eveningStart = new Date(arrived);
    eveningStart.setHours(17, 0, 0, 0);
    const eveningEnd = new Date(arrived);
    eveningEnd.setHours(22, 0, 0, 0);
    const startMs = Math.max(arrived.getTime(), eveningStart.getTime());
    const endMs = Math.min(end.getTime(), eveningEnd.getTime());
    if (endMs > startMs) minutes += Math.round((endMs - startMs) / 60_000);
  }
  return minutes;
}

export function buildFamilyTimeIntel(opts: {
  trips: DriveTripSummary[];
  placeVisits: FamilyPlaceVisitView[];
  homePlaceNames: string[];
  now?: Date;
}): FamilyTimeIntel | null {
  const now = opts.now ?? new Date();
  const homeNames = new Set(opts.homePlaceNames.map((n) => n.toLowerCase()).filter(Boolean));

  const weekMs = 7 * 24 * 60 * 60_000;
  const thisWeekStart = now.getTime() - weekMs;
  const prevWeekStart = now.getTime() - 2 * weekMs;

  const thisWeekTrips = opts.trips.filter((t) => {
    const at = t.endedAt ?? t.startedAt;
    if (!at) return false;
    const ts = new Date(at).getTime();
    return ts >= thisWeekStart && isCommuteTrip(t);
  });
  const prevWeekTrips = opts.trips.filter((t) => {
    const at = t.endedAt ?? t.startedAt;
    if (!at) return false;
    const ts = new Date(at).getTime();
    return ts >= prevWeekStart && ts < thisWeekStart && isCommuteTrip(t);
  });

  const daysThis = new Set(
    thisWeekTrips.map((t) => dayKey((t.endedAt ?? t.startedAt)!)).filter(Boolean)
  );
  const daysPrev = new Set(
    prevWeekTrips.map((t) => dayKey((t.endedAt ?? t.startedAt)!)).filter(Boolean)
  );

  const sumMin = (list: DriveTripSummary[]) =>
    list.reduce((a, t) => a + Math.max(0, t.durationMinutes), 0);

  const commuteMinPerDay =
    daysThis.size > 0
      ? Math.round(sumMin(thisWeekTrips) / daysThis.size)
      : thisWeekTrips.length
        ? Math.round(sumMin(thisWeekTrips) / Math.max(1, thisWeekTrips.length))
        : 0;

  const prevPerDay =
    daysPrev.size > 0 ? Math.round(sumMin(prevWeekTrips) / daysPrev.size) : null;

  const commuteDeltaMinPerDay =
    prevPerDay != null && commuteMinPerDay > 0 ? commuteMinPerDay - prevPerDay : null;

  const weekVisits = opts.placeVisits.filter((v) => {
    const ts = new Date(v.arrivedAt).getTime();
    return ts >= thisWeekStart;
  });
  const eveningMin = eveningHomeMinutes(weekVisits, homeNames);
  const totalHomeMin = homeMinutes(weekVisits, homeNames);
  // Prefer evening when we have it; otherwise total home dwell so the card
  // isn't stuck on "Learning…" when people are home all day.
  const familyHomeHoursWeek =
    Math.round(((eveningMin > 0 ? eveningMin : totalHomeMin) / 60) * 10) / 10;

  // Always return something once Home exists or we have any trip/visit signal.
  if (commuteMinPerDay === 0 && familyHomeHoursWeek === 0) {
    if (homeNames.size === 0 && opts.trips.length === 0 && opts.placeVisits.length === 0) {
      return null;
    }
    return {
      commuteMinPerDay: 0,
      commuteDeltaMinPerDay: null,
      familyHomeHoursWeek: 0,
      insight:
        homeNames.size > 0
          ? "Home is saved. Evening family-time hours and commute averages fill in as Share Live stays on."
          : "Save a Home place on the map so we can measure evening family time.",
    };
  }

  let insight: string;
  if (commuteDeltaMinPerDay != null && Math.abs(commuteDeltaMinPerDay) >= 5) {
    const sign = commuteDeltaMinPerDay > 0 ? "+" : "";
    const lostHrs =
      commuteDeltaMinPerDay > 0
        ? Math.round(((commuteDeltaMinPerDay * 5) / 60) * 10) / 10
        : null;
    insight =
      lostHrs != null
        ? `Commute ${sign}${commuteDeltaMinPerDay} min/day vs last week · ~${lostHrs} hrs/week less for evening family time.`
        : `Commute ${sign}${commuteDeltaMinPerDay} min/day vs last week · ${familyHomeHoursWeek} hrs at home this week.`;
  } else if (familyHomeHoursWeek > 0) {
    insight = `About ${familyHomeHoursWeek} hrs at home this week${
      commuteMinPerDay > 0 ? ` · commute ~${commuteMinPerDay} min/day` : ""
    }.`;
  } else if (commuteMinPerDay > 0) {
    insight = `Commute averaging ~${commuteMinPerDay} min/day this week. Home hours appear once you dwell at Home.`;
  } else {
    insight = "Keep Share Live on — family time builds from drives and Home stays.";
  }

  return {
    commuteMinPerDay,
    commuteDeltaMinPerDay,
    familyHomeHoursWeek,
    insight,
  };
}

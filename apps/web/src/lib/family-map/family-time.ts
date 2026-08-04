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
    /\b(home|work|school|office)\b/.test(to)
  );
}

function eveningHomeMinutes(visits: FamilyPlaceVisitView[], homeNames: Set<string>) {
  let minutes = 0;
  for (const v of visits) {
    if (!homeNames.has(v.placeName.toLowerCase())) continue;
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
  const homeNames = new Set(opts.homePlaceNames.map((n) => n.toLowerCase()));
  if (homeNames.size === 0 && opts.trips.length === 0) return null;

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
  const familyHomeHoursWeek = Math.round((eveningMin / 60) * 10) / 10;

  if (commuteMinPerDay === 0 && familyHomeHoursWeek === 0) return null;

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
        : `Commute ${sign}${commuteDeltaMinPerDay} min/day vs last week · ${familyHomeHoursWeek} hrs evening-at-home this week.`;
  } else if (familyHomeHoursWeek > 0) {
    insight = `About ${familyHomeHoursWeek} hrs of evening time at home this week${
      commuteMinPerDay > 0 ? ` · commute ~${commuteMinPerDay} min/day` : ""
    }.`;
  } else if (commuteMinPerDay > 0) {
    insight = `Commute averaging ~${commuteMinPerDay} min/day this week. Evening-at-home hours appear once Home visits log.`;
  } else {
    return null;
  }

  return {
    commuteMinPerDay,
    commuteDeltaMinPerDay,
    familyHomeHoursWeek,
    insight,
  };
}

/**
 * Household Weekly Driving Report — aggregates FamilyTrip telematics
 * (hard braking, rapid accel, unusual events, top speed, distance).
 * Learning notes are quality-gated so GPS spam never becomes "truth".
 */

import { prisma } from "@forward/database";
import {
  driveScoreBand,
  type DrivingReport,
  type DrivingReportDelta,
  type DrivingReportMemberRow,
  type DrivingReportPeriod,
  type DrivingReportTotals,
  type DriveTripSummary,
  sanitizeSpeedKmh,
} from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { getMemberForUser } from "./household";
import { coalesceDriveTrips, isNoiseDriveTrip } from "./history";

const PERIODS: DrivingReportPeriod[] = ["this_week", "last_week", "week_2", "week_3"];

/** Real road trips only — GPS geofence jitter is not a drive. */
const MIN_REPORT_DISTANCE_KM = 0.8;
const MIN_REPORT_DURATION_MIN = 4;
/** Arrival "around X" needs times clustered near the median. */
const ARRIVE_CLUSTER_MINUTES = 75;
/** Minimum distinct calendar days before we claim a weekly pattern. */
const MIN_PATTERN_DAYS = 3;

function startOfLocalMonday(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + offset);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatWeekLabel(start: Date, end: Date, period: DrivingReportPeriod): string {
  if (period === "this_week") return "This week";
  if (period === "last_week") return "Last week";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const a = start.toLocaleDateString([], opts);
  const b = addDays(end, -1).toLocaleDateString([], opts);
  return `${a} – ${b}`;
}

function periodWindow(period: DrivingReportPeriod): { start: Date; end: Date } {
  const thisMon = startOfLocalMonday();
  const weeksBack =
    period === "this_week" ? 0 : period === "last_week" ? 1 : period === "week_2" ? 2 : 3;
  const start = addDays(thisMon, -7 * weeksBack);
  const end = weeksBack === 0 ? new Date() : addDays(start, 7);
  return { start, end };
}

function emptyTotals(): DrivingReportTotals {
  return {
    drives: 0,
    distanceKm: 0,
    hardBraking: 0,
    rapidAcceleration: 0,
    unusualRouteEvents: 0,
    phoneUsageEvents: 0,
    riskyEvents: 0,
    topSpeedKmh: 0,
    topSpeedMemberName: null,
    avgDriveScore: null,
  };
}

function formatMinute(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = Math.abs(m % 60);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${ampm}`;
}

function localDayKey(at: Date, tzOffsetMinutes: number | null): string {
  if (tzOffsetMinutes == null || !Number.isFinite(tzOffsetMinutes)) {
    return at.toISOString().slice(0, 10);
  }
  const localMs = at.getTime() - Math.trunc(tzOffsetMinutes) * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

function localMinuteOfDay(at: Date, tzOffsetMinutes: number | null): number {
  if (tzOffsetMinutes == null || !Number.isFinite(tzOffsetMinutes)) {
    return at.getHours() * 60 + at.getMinutes();
  }
  const localMs = at.getTime() - Math.trunc(tzOffsetMinutes) * 60_000;
  const d = new Date(localMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function periodDaySpan(start: Date, end: Date): number {
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.max(1, Math.min(31, Math.ceil(ms / 86_400_000)));
}

/** Median arrive time only when enough samples sit in a tight cluster. */
function clusteredArriveMinute(minutes: number[]): number | null {
  if (minutes.length < MIN_PATTERN_DAYS) return null;
  const sorted = [...minutes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const near = minutes.filter((m) => Math.abs(m - median) <= ARRIVE_CLUSTER_MINUTES);
  if (near.length < MIN_PATTERN_DAYS) return null;
  return Math.round(near.reduce((a, b) => a + b, 0) / near.length);
}

function buildInsight(
  totals: DrivingReportTotals,
  members: DrivingReportMemberRow[],
  vsPrevious: DrivingReportDelta | null
): string | null {
  if (totals.drives === 0) {
    return "No completed drives in this period yet — keep Share live on during trips.";
  }

  const parts: string[] = [];

  if (vsPrevious && vsPrevious.riskyEvents !== 0) {
    if (vsPrevious.riskyEvents < 0) {
      parts.push(
        `Safer than last week — phone-in-use events down ${Math.abs(vsPrevious.riskyEvents)}.`
      );
    } else {
      parts.push(
        `More phone-in-use while driving than last week (+${vsPrevious.riskyEvents}).`
      );
    }
  }

  const phoneRisk = [...members]
    .filter((m) => m.phoneUsageEvents > 0)
    .sort((a, b) => b.phoneUsageEvents - a.phoneUsageEvents)[0];
  if (phoneRisk && phoneRisk.phoneUsageEvents >= 2) {
    parts.push(
      `${phoneRisk.displayName} had the phone in use ${phoneRisk.phoneUsageEvents}× while driving.`
    );
  }

  // Only mention top speed when it's a believable highway-high reading — never GPS spikes.
  if (
    totals.topSpeedMemberName &&
    totals.topSpeedKmh >= 110 &&
    totals.topSpeedKmh <= 140
  ) {
    parts.push(
      `Highest trusted speed ${Math.round(totals.topSpeedKmh)} km/h (${totals.topSpeedMemberName}).`
    );
  }

  if (totals.avgDriveScore != null) {
    if (totals.avgDriveScore >= 85) {
      parts.push(`Household Drive Score averaging ${totals.avgDriveScore}/100 — solid.`);
    } else if (totals.avgDriveScore < 70) {
      parts.push(
        `Average Drive Score ${totals.avgDriveScore}/100 — check phone use on drives.`
      );
    }
  }

  if (parts.length === 0) {
    return `${totals.drives} drives · ${totals.distanceKm.toFixed(1)} km this period.`;
  }
  return parts.slice(0, 2).join(" ");
}

function isReportableTrip(t: {
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  durationMinutes: number;
}): boolean {
  if (t.toLabel === "In progress") return false;
  if (t.distanceKm < MIN_REPORT_DISTANCE_KM) return false;
  if (t.durationMinutes < MIN_REPORT_DURATION_MIN) return false;
  if (isNoiseDriveTrip(t)) return false;
  return true;
}

async function loadCleanTrips(opts: {
  memberIds: string[];
  start: Date;
  end: Date;
}): Promise<DriveTripSummary[]> {
  const raw = await prisma.familyTrip.findMany({
    where: {
      memberId: { in: opts.memberIds },
      isActive: false,
      endedAt: { not: null, gte: opts.start, lt: opts.end },
    },
    select: {
      id: true,
      memberId: true,
      fromLabel: true,
      toLabel: true,
      distanceKm: true,
      durationMinutes: true,
      avgSpeedKmh: true,
      maxSpeedKmh: true,
      phoneUsageEvents: true,
      driveScore: true,
      startedAt: true,
      endedAt: true,
      estimatedFuelCostCad: true,
    },
  });

  const mapped: DriveTripSummary[] = raw
    .filter((t) =>
      isReportableTrip({
        fromLabel: t.fromLabel,
        toLabel: t.toLabel,
        distanceKm: t.distanceKm ?? 0,
        durationMinutes: t.durationMinutes ?? 0,
      })
    )
    .map((t) => {
      const score = t.driveScore ?? 100;
      return {
        id: t.id,
        memberId: t.memberId,
        fromLabel: t.fromLabel,
        toLabel: t.toLabel,
        distanceKm: t.distanceKm ?? 0,
        durationMinutes: t.durationMinutes ?? 0,
        avgSpeedKmh: t.avgSpeedKmh ?? 0,
        maxSpeedKmh: sanitizeSpeedKmh(t.maxSpeedKmh) ?? 0,
        hardBraking: 0,
        rapidAcceleration: 0,
        unusualRouteEvents: 0,
        phoneUsageEvents: t.phoneUsageEvents ?? 0,
        driveScore: score,
        band: driveScoreBand(score),
        estimatedFuelCostCad: t.estimatedFuelCostCad,
        startedAt: t.startedAt?.toISOString(),
        endedAt: t.endedAt?.toISOString() ?? null,
      };
    });

  return coalesceDriveTrips(mapped);
}

/**
 * Place-stay patterns only — never trip-end spam ("28× this week").
 * Requires distinct calendar days + clustered arrival times.
 */
async function buildTrustedPeriodNotes(opts: {
  memberIds: string[];
  start: Date;
  end: Date;
  tzOffsetMinutes: number | null;
  daySpan: number;
}): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (opts.memberIds.length === 0) return out;

  const visits = await prisma.familyPlaceVisit.findMany({
    where: {
      memberId: { in: opts.memberIds },
      arrivedAt: { gte: opts.start, lt: opts.end },
      // Ignore bounce-in geofence noise.
      OR: [{ dwellMinutes: { gte: 20 } }, { isActive: true }],
    },
    select: {
      memberId: true,
      placeName: true,
      arrivedAt: true,
      dwellMinutes: true,
      isActive: true,
    },
    orderBy: { arrivedAt: "asc" },
    take: 800,
  });

  type Bucket = {
    days: Set<string>;
    minutes: number[];
  };
  const byMemberPlace = new Map<string, Bucket>();

  for (const v of visits) {
    const place = (v.placeName ?? "").trim();
    if (!place || place.length < 2) continue;
    // Active stays with tiny dwell still count if they've been there a while wall-clock.
    if (!v.isActive && v.dwellMinutes < 20) continue;
    const day = localDayKey(v.arrivedAt, opts.tzOffsetMinutes);
    const minute = localMinuteOfDay(v.arrivedAt, opts.tzOffsetMinutes);
    const key = `${v.memberId}::${place.toLowerCase()}`;
    const bucket = byMemberPlace.get(key) ?? { days: new Set(), minutes: [] };
    // One arrival sample per place per day (first of the day).
    if (bucket.days.has(day)) continue;
    bucket.days.add(day);
    bucket.minutes.push(minute);
    byMemberPlace.set(key, bucket);
  }

  const bestByMember = new Map<
    string,
    { place: string; days: number; arrive: number; score: number }
  >();

  for (const [key, bucket] of byMemberPlace) {
    const [memberId, ...placeParts] = key.split("::");
    if (!memberId) continue;
    const place = placeParts.join("::");
    const dayCount = bucket.days.size;
    if (dayCount < MIN_PATTERN_DAYS) continue;
    // Never claim more days than the period can hold.
    if (dayCount > opts.daySpan) continue;
    const arrive = clusteredArriveMinute(bucket.minutes);
    if (arrive == null) continue;
    // Prefer non-overnight oddities for "pattern" headlines (5am–10pm).
    if (arrive < 5 * 60 || arrive > 22 * 60) continue;
    const score = dayCount * 10 - Math.abs(arrive - 12 * 60) / 60;
    const prev = bestByMember.get(memberId);
    if (!prev || score > prev.score) {
      // Recover display casing from a visit row.
      const sample = visits.find(
        (v) =>
          v.memberId === memberId &&
          v.placeName.trim().toLowerCase() === place
      );
      bestByMember.set(memberId, {
        place: sample?.placeName.trim() || place,
        days: dayCount,
        arrive,
        score,
      });
    }
  }

  for (const memberId of opts.memberIds) {
    const best = bestByMember.get(memberId);
    if (!best) {
      out.set(memberId, []);
      continue;
    }
    out.set(memberId, [
      `Often at ${best.place} around ${formatMinute(best.arrive)} (${best.days} of ${opts.daySpan} days)`,
    ]);
  }

  return out;
}

async function aggregateWindow(opts: {
  memberIds: string[];
  membersById: Map<string, { displayName: string; color: string }>;
  start: Date;
  end: Date;
  tzOffsetMinutes?: number | null;
}): Promise<{ totals: DrivingReportTotals; members: DrivingReportMemberRow[] }> {
  if (opts.memberIds.length === 0) {
    return { totals: emptyTotals(), members: [] };
  }

  const trips = await loadCleanTrips({
    memberIds: opts.memberIds,
    start: opts.start,
    end: opts.end,
  });

  const daySpan = periodDaySpan(opts.start, opts.end);
  const periodNotes = await buildTrustedPeriodNotes({
    memberIds: opts.memberIds,
    start: opts.start,
    end: opts.end,
    tzOffsetMinutes: opts.tzOffsetMinutes ?? null,
    daySpan,
  });

  const byMember = new Map<
    string,
    {
      driveCount: number;
      distanceKm: number;
      phoneUsageEvents: number;
      topSpeedKmh: number;
      scoreSum: number;
      fuelCostCad: number;
    }
  >();

  for (const id of opts.memberIds) {
    byMember.set(id, {
      driveCount: 0,
      distanceKm: 0,
      phoneUsageEvents: 0,
      topSpeedKmh: 0,
      scoreSum: 0,
      fuelCostCad: 0,
    });
  }

  let topSpeedKmh = 0;
  let topSpeedMemberId: string | null = null;
  let scoreSum = 0;

  for (const t of trips) {
    if (!t.memberId) continue;
    const row = byMember.get(t.memberId);
    if (!row) continue;
    row.driveCount += 1;
    row.distanceKm += t.distanceKm ?? 0;
    row.phoneUsageEvents += t.phoneUsageEvents ?? 0;
    row.scoreSum += t.driveScore ?? 0;
    row.fuelCostCad += t.estimatedFuelCostCad ?? 0;
    const tripTop = sanitizeSpeedKmh(t.maxSpeedKmh) ?? 0;
    if (tripTop > row.topSpeedKmh) row.topSpeedKmh = tripTop;
    if (tripTop > topSpeedKmh) {
      topSpeedKmh = tripTop;
      topSpeedMemberId = t.memberId;
    }
    scoreSum += t.driveScore ?? 0;
  }

  const members: DrivingReportMemberRow[] = opts.memberIds
    .map((id) => {
      const meta = opts.membersById.get(id)!;
      const row = byMember.get(id)!;
      const learningNotes = [...(periodNotes.get(id) ?? [])];
      if (row.driveCount > 0 && row.distanceKm >= 5) {
        learningNotes.push(
          `Drove ${row.distanceKm.toFixed(1)} km across ${row.driveCount} ${
            row.driveCount === 1 ? "drive" : "drives"
          }`
        );
      }
      return {
        memberId: id,
        displayName: meta.displayName,
        color: meta.color,
        driveCount: row.driveCount,
        distanceKm: Number(row.distanceKm.toFixed(1)),
        hardBraking: 0,
        rapidAcceleration: 0,
        unusualRouteEvents: 0,
        phoneUsageEvents: row.phoneUsageEvents,
        riskyEvents: row.phoneUsageEvents,
        topSpeedKmh: Math.round(row.topSpeedKmh),
        avgDriveScore:
          row.driveCount > 0 ? Math.round(row.scoreSum / row.driveCount) : null,
        learningNotes: learningNotes.slice(0, 3),
        estimatedFuelCostCad:
          row.fuelCostCad > 0 ? Number(row.fuelCostCad.toFixed(2)) : null,
      };
    })
    .filter((m) => m.driveCount > 0)
    .sort((a, b) => b.distanceKm - a.distanceKm);

  const phoneUsageEvents = trips.reduce((a, t) => a + (t.phoneUsageEvents ?? 0), 0);
  const totals: DrivingReportTotals = {
    drives: trips.length,
    distanceKm: Number(
      trips.reduce((a, t) => a + (t.distanceKm ?? 0), 0).toFixed(1)
    ),
    hardBraking: 0,
    rapidAcceleration: 0,
    unusualRouteEvents: 0,
    phoneUsageEvents,
    riskyEvents: phoneUsageEvents,
    topSpeedKmh: Math.round(topSpeedKmh),
    topSpeedMemberName: topSpeedMemberId
      ? opts.membersById.get(topSpeedMemberId)?.displayName ?? null
      : null,
    avgDriveScore: trips.length > 0 ? Math.round(scoreSum / trips.length) : null,
  };

  return { totals, members };
}

export function isDrivingReportPeriod(v: string): v is DrivingReportPeriod {
  return (PERIODS as string[]).includes(v);
}

export async function getHouseholdDrivingReport(opts: {
  viewerUserId: string;
  period: DrivingReportPeriod;
  tzOffsetMinutes?: number | null;
}): Promise<DrivingReport> {
  await ensureFamilyMapSchema();
  const viewer = await getMemberForUser(opts.viewerUserId);
  if (!viewer) throw new Error("NO_HOUSEHOLD");

  const householdMembers = await prisma.familyMember.findMany({
    where: { householdId: viewer.householdId },
    select: { id: true, displayName: true, color: true, isSimulated: true },
    orderBy: { displayName: "asc" },
  });

  const real = householdMembers.filter((m) => !m.isSimulated);
  const membersById = new Map(
    real.map((m) => [m.id, { displayName: m.displayName, color: m.color }])
  );
  const memberIds = real.map((m) => m.id);
  const tzOffsetMinutes = opts.tzOffsetMinutes ?? null;

  const { start, end } = periodWindow(opts.period);
  const current = await aggregateWindow({
    memberIds,
    membersById,
    start,
    end,
    tzOffsetMinutes,
  });

  const prevStart = addDays(start, -7);
  const prevEnd = start;
  const previous = await aggregateWindow({
    memberIds,
    membersById,
    start: prevStart,
    end: prevEnd,
    tzOffsetMinutes,
  });

  let vsPrevious: DrivingReportDelta | null = null;
  if (previous.totals.drives > 0 || current.totals.drives > 0) {
    vsPrevious = {
      hardBraking: 0,
      rapidAcceleration: 0,
      unusualRouteEvents: 0,
      phoneUsageEvents:
        current.totals.phoneUsageEvents - previous.totals.phoneUsageEvents,
      riskyEvents: current.totals.riskyEvents - previous.totals.riskyEvents,
      distanceKm: Number(
        (current.totals.distanceKm - previous.totals.distanceKm).toFixed(1)
      ),
      drives: current.totals.drives - previous.totals.drives,
    };
  }

  // Long-term routines — clearly labeled "over time", never as this-week counts.
  const routineRows = await prisma.familyRoutineStat.findMany({
    where: {
      memberId: { in: memberIds },
      sampleCount: { gte: 6 },
      usualArriveMinute: { not: null },
    },
    orderBy: [{ sampleCount: "desc" }],
    take: 40,
  });

  const membersWithRoutines = current.members.map((m) => {
    const notes = [...(m.learningNotes ?? [])];
    const hasPeriodPattern = notes.some((n) => /often at /i.test(n));
    if (!hasPeriodPattern) {
      const routine = routineRows.find((r) => {
        if (r.memberId !== m.memberId || r.usualArriveMinute == null) return false;
        const minute = r.usualArriveMinute;
        return minute >= 5 * 60 && minute <= 22 * 60;
      });
      if (routine && routine.usualArriveMinute != null) {
        const days =
          ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"][
            routine.dayOfWeek
          ] ?? "that day";
        notes.unshift(
          `Over time: usually at ${routine.placeName} around ${formatMinute(
            routine.usualArriveMinute
          )} on ${days}`
        );
      }
    }
    return { ...m, learningNotes: notes.slice(0, 3) };
  });

  const baseInsight = buildInsight(current.totals, membersWithRoutines, vsPrevious);
  const insight = baseInsight;

  const memberInsights = membersWithRoutines.map((m) => {
    const pattern = (m.learningNotes ?? []).find((n) =>
      /often at |over time:/i.test(n)
    );
    return {
      memberId: m.memberId,
      displayName: m.displayName,
      summary:
        pattern ??
        (m.driveCount > 0
          ? `${m.driveCount} ${m.driveCount === 1 ? "drive" : "drives"} · ${m.distanceKm} km`
          : "No trusted drives in this period"),
    };
  });

  const { letterHeadline, letterParagraphs } = buildLearningLetter({
    insight,
    members: membersWithRoutines,
    memberInsights,
    totals: current.totals,
  });

  return {
    period: opts.period,
    label: formatWeekLabel(start, end, opts.period),
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    totals: current.totals,
    members: membersWithRoutines,
    insight,
    vsPrevious,
    memberInsights,
    letterHeadline,
    letterParagraphs,
  };
}

function buildLearningLetter(opts: {
  insight: string | null;
  members: DrivingReportMemberRow[];
  memberInsights: Array<{ memberId: string; displayName: string; summary: string }>;
  totals: DrivingReportTotals;
}): { letterHeadline: string; letterParagraphs: string[] } {
  const trusted = opts.members.find((m) =>
    (m.learningNotes ?? []).some((n) => /often at |over time:/i.test(n))
  );
  const firstNote =
    trusted?.learningNotes?.find((n) => /often at |over time:/i.test(n)) ?? null;

  let letterHeadline: string;
  if (trusted && firstNote) {
    const placeMatch = firstNote.match(/at ([^~]+?)(?:\s+around)/i);
    const place = placeMatch?.[1]?.trim();
    const firstName = trusted.displayName.split(" ")[0] ?? trusted.displayName;
    if (place && /often at /i.test(firstNote)) {
      const t = firstNote.match(/around\s+(\d{1,2}:\d{2}\s*[ap]m)/i)?.[1] ?? "";
      const h = parseInt(t, 10);
      const isPm = /pm/i.test(t);
      const hour24 = Number.isFinite(h)
        ? isPm
          ? h === 12
            ? 12
            : h + 12
          : h === 12
            ? 0
            : h
        : null;
      const timeOfDay =
        hour24 == null
          ? null
          : hour24 < 12
            ? "morning"
            : hour24 < 17
              ? "afternoon"
              : "evening";
      letterHeadline = timeOfDay
        ? `We noticed ${firstName}’s ${timeOfDay} ${place} rhythm`
        : `We noticed ${firstName}’s ${place} rhythm`;
    } else if (place) {
      letterHeadline = `We’re learning ${firstName}’s ${place} rhythm`;
    } else {
      letterHeadline = "Your family’s weekly learning letter";
    }
  } else if (opts.totals.drives > 0) {
    letterHeadline = "Your family’s week on the road";
  } else {
    letterHeadline = "A quiet week for the household";
  }

  const paragraphs: string[] = [];
  if (opts.insight) paragraphs.push(opts.insight);

  const patternLines = opts.memberInsights
    .filter((mi) => /often at |over time:/i.test(mi.summary))
    .slice(0, 3)
    .map((mi) => `${mi.displayName}: ${mi.summary}`);
  paragraphs.push(...patternLines);

  if (paragraphs.length === 1 && opts.totals.drives > 0) {
    paragraphs.push(
      `${opts.totals.drives} trusted ${
        opts.totals.drives === 1 ? "drive" : "drives"
      } · ${opts.totals.distanceKm} km (short GPS jitters filtered out).`
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push("Keep Share live on during trips — patterns appear after a few real days.");
  }

  return { letterHeadline, letterParagraphs: paragraphs.slice(0, 4) };
}

/** Monday cron — notify each household member that last week's report is ready. */
export async function notifyWeeklyDrivingReportsReady(): Promise<{
  households: number;
  notifications: number;
}> {
  await ensureFamilyMapSchema();
  const { createNotification } = await import("@/lib/notifications");

  const households = await prisma.familyHousehold.findMany({
    select: {
      id: true,
      ownerUserId: true,
      members: {
        where: { isSimulated: false, userId: { not: null } },
        select: { id: true, userId: true, displayName: true },
      },
    },
  });

  let notifications = 0;
  const weekKey = startOfLocalMonday().toISOString().slice(0, 10);

  for (const hh of households) {
    if (!hh.members.length || !hh.ownerUserId) continue;

    let report: DrivingReport;
    try {
      report = await getHouseholdDrivingReport({
        viewerUserId: hh.ownerUserId,
        period: "last_week",
      });
    } catch {
      continue;
    }
    if (report.totals.drives === 0) continue;

    const since = addDays(startOfLocalMonday(), -1);
    const already = await prisma.notification.findFirst({
      where: {
        type: "family_weekly_drive_report",
        body: { contains: weekKey },
        createdAt: { gte: since },
        userId: { in: hh.members.map((m) => m.userId!).filter(Boolean) },
      },
      select: { id: true },
    });
    if (already) continue;

    for (const m of hh.members) {
      if (!m.userId) continue;
      const personalInsight = report.memberInsights?.find((i) => i.memberId === m.id);
      const trusted = personalInsight && /often at |over time:/i.test(personalInsight.summary);
      const title = trusted
        ? report.letterHeadline ?? `We noticed ${m.displayName.split(" ")[0]}’s week`
        : "Your family’s weekly learning letter";
      const personal =
        personalInsight?.summary ??
        report.letterParagraphs?.[0] ??
        report.insight ??
        `${report.totals.drives} household drives · ${report.totals.distanceKm} km`;
      await createNotification({
        userId: m.userId,
        type: "family_weekly_drive_report",
        title,
        body: `${weekKey} · ${personal}`,
        href: "/family-map",
      });
      notifications += 1;
    }
  }

  return { households: households.length, notifications };
}

export function drivingReportPeriodOptions(): {
  id: DrivingReportPeriod;
  label: string;
}[] {
  const thisMon = startOfLocalMonday();
  return [
    { id: "this_week", label: "This week" },
    { id: "last_week", label: "Last week" },
    {
      id: "week_2",
      label: formatWeekLabel(addDays(thisMon, -14), addDays(thisMon, -7), "week_2"),
    },
    {
      id: "week_3",
      label: formatWeekLabel(addDays(thisMon, -21), addDays(thisMon, -14), "week_3"),
    },
  ];
}

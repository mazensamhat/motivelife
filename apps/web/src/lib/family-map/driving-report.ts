/**
 * Household Weekly Driving Report — aggregates FamilyTrip telematics
 * (hard braking, rapid accel, unusual events, top speed, distance).
 * Life360 paywalls this; we surface it with AI-style insights.
 */

import { prisma } from "@forward/database";
import {
  type DrivingReport,
  type DrivingReportDelta,
  type DrivingReportMemberRow,
  type DrivingReportPeriod,
  type DrivingReportTotals,
} from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { getMemberForUser } from "./household";

const PERIODS: DrivingReportPeriod[] = ["this_week", "last_week", "week_2", "week_3"];

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
    riskyEvents: 0,
    topSpeedKmh: 0,
    topSpeedMemberName: null,
    avgDriveScore: null,
  };
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
        `Safer than last week — risky events down ${Math.abs(vsPrevious.riskyEvents)}.`
      );
    } else {
      parts.push(
        `More risky events than last week (+${vsPrevious.riskyEvents}) — worth a calm check-in.`
      );
    }
  }

  const riskiest = [...members]
    .filter((m) => m.riskyEvents > 0)
    .sort((a, b) => b.riskyEvents - a.riskyEvents)[0];
  if (riskiest && riskiest.riskyEvents >= 2) {
    parts.push(
      `${riskiest.displayName} had ${riskiest.riskyEvents} risky events (${riskiest.hardBraking} hard brakes, ${riskiest.rapidAcceleration} rapid accel).`
    );
  }

  if (totals.topSpeedMemberName && totals.topSpeedKmh >= 90) {
    parts.push(
      `Top speed ${Math.round(totals.topSpeedKmh)} km/h by ${totals.topSpeedMemberName}.`
    );
  }

  if (totals.avgDriveScore != null) {
    if (totals.avgDriveScore >= 85) {
      parts.push(`Household Drive Score averaging ${totals.avgDriveScore}/100 — solid.`);
    } else if (totals.avgDriveScore < 70) {
      parts.push(
        `Average Drive Score ${totals.avgDriveScore}/100 — review hard braking and rapid accel.`
      );
    }
  }

  if (parts.length === 0) {
    return `${totals.drives} drives · ${totals.distanceKm.toFixed(1)} km · Drive Score ${totals.avgDriveScore ?? "—"}.`;
  }
  return parts.slice(0, 2).join(" ");
}

async function aggregateWindow(opts: {
  memberIds: string[];
  membersById: Map<string, { displayName: string; color: string }>;
  start: Date;
  end: Date;
}): Promise<{ totals: DrivingReportTotals; members: DrivingReportMemberRow[] }> {
  if (opts.memberIds.length === 0) {
    return { totals: emptyTotals(), members: [] };
  }

  const trips = await prisma.familyTrip.findMany({
    where: {
      memberId: { in: opts.memberIds },
      isActive: false,
      endedAt: { not: null, gte: opts.start, lt: opts.end },
    },
    select: {
      memberId: true,
      distanceKm: true,
      maxSpeedKmh: true,
      hardBraking: true,
      rapidAcceleration: true,
      unusualRouteEvents: true,
      driveScore: true,
    },
  });

  const byMember = new Map<
    string,
    {
      driveCount: number;
      distanceKm: number;
      hardBraking: number;
      rapidAcceleration: number;
      unusualRouteEvents: number;
      topSpeedKmh: number;
      scoreSum: number;
    }
  >();

  for (const id of opts.memberIds) {
    byMember.set(id, {
      driveCount: 0,
      distanceKm: 0,
      hardBraking: 0,
      rapidAcceleration: 0,
      unusualRouteEvents: 0,
      topSpeedKmh: 0,
      scoreSum: 0,
    });
  }

  let topSpeedKmh = 0;
  let topSpeedMemberId: string | null = null;
  let scoreSum = 0;

  for (const t of trips) {
    const row = byMember.get(t.memberId);
    if (!row) continue;
    row.driveCount += 1;
    row.distanceKm += t.distanceKm ?? 0;
    row.hardBraking += t.hardBraking ?? 0;
    row.rapidAcceleration += t.rapidAcceleration ?? 0;
    row.unusualRouteEvents += t.unusualRouteEvents ?? 0;
    row.scoreSum += t.driveScore ?? 0;
    if ((t.maxSpeedKmh ?? 0) > row.topSpeedKmh) row.topSpeedKmh = t.maxSpeedKmh ?? 0;
    if ((t.maxSpeedKmh ?? 0) > topSpeedKmh) {
      topSpeedKmh = t.maxSpeedKmh ?? 0;
      topSpeedMemberId = t.memberId;
    }
    scoreSum += t.driveScore ?? 0;
  }

  const members: DrivingReportMemberRow[] = opts.memberIds
    .map((id) => {
      const meta = opts.membersById.get(id)!;
      const row = byMember.get(id)!;
      const risky =
        row.hardBraking + row.rapidAcceleration + row.unusualRouteEvents;
      return {
        memberId: id,
        displayName: meta.displayName,
        color: meta.color,
        driveCount: row.driveCount,
        distanceKm: Number(row.distanceKm.toFixed(1)),
        hardBraking: row.hardBraking,
        rapidAcceleration: row.rapidAcceleration,
        unusualRouteEvents: row.unusualRouteEvents,
        riskyEvents: risky,
        topSpeedKmh: Math.round(row.topSpeedKmh),
        avgDriveScore:
          row.driveCount > 0 ? Math.round(row.scoreSum / row.driveCount) : null,
      };
    })
    .filter((m) => m.driveCount > 0)
    .sort((a, b) => b.distanceKm - a.distanceKm);

  const totals: DrivingReportTotals = {
    drives: trips.length,
    distanceKm: Number(
      trips.reduce((a, t) => a + (t.distanceKm ?? 0), 0).toFixed(1)
    ),
    hardBraking: trips.reduce((a, t) => a + (t.hardBraking ?? 0), 0),
    rapidAcceleration: trips.reduce((a, t) => a + (t.rapidAcceleration ?? 0), 0),
    unusualRouteEvents: trips.reduce((a, t) => a + (t.unusualRouteEvents ?? 0), 0),
    riskyEvents: 0,
    topSpeedKmh: Math.round(topSpeedKmh),
    topSpeedMemberName: topSpeedMemberId
      ? opts.membersById.get(topSpeedMemberId)?.displayName ?? null
      : null,
    avgDriveScore: trips.length > 0 ? Math.round(scoreSum / trips.length) : null,
  };
  totals.riskyEvents =
    totals.hardBraking + totals.rapidAcceleration + totals.unusualRouteEvents;

  return { totals, members };
}

export function isDrivingReportPeriod(v: string): v is DrivingReportPeriod {
  return (PERIODS as string[]).includes(v);
}

export async function getHouseholdDrivingReport(opts: {
  viewerUserId: string;
  period: DrivingReportPeriod;
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

  const { start, end } = periodWindow(opts.period);
  const current = await aggregateWindow({
    memberIds,
    membersById,
    start,
    end,
  });

  // Previous week for trend arrows
  const prevStart = addDays(start, -7);
  const prevEnd = start;
  const previous = await aggregateWindow({
    memberIds,
    membersById,
    start: prevStart,
    end: prevEnd,
  });

  let vsPrevious: DrivingReportDelta | null = null;
  if (previous.totals.drives > 0 || current.totals.drives > 0) {
    vsPrevious = {
      hardBraking: current.totals.hardBraking - previous.totals.hardBraking,
      rapidAcceleration:
        current.totals.rapidAcceleration - previous.totals.rapidAcceleration,
      unusualRouteEvents:
        current.totals.unusualRouteEvents - previous.totals.unusualRouteEvents,
      riskyEvents: current.totals.riskyEvents - previous.totals.riskyEvents,
      distanceKm: Number(
        (current.totals.distanceKm - previous.totals.distanceKm).toFixed(1)
      ),
      drives: current.totals.drives - previous.totals.drives,
    };
  }

  return {
    period: opts.period,
    label: formatWeekLabel(start, end, opts.period),
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    totals: current.totals,
    members: current.members,
    insight: buildInsight(current.totals, current.members, vsPrevious),
    vsPrevious,
  };
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

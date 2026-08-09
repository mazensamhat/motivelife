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
  sanitizeSpeedKmh,
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
    phoneUsageEvents: 0,
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

  const phoneRisk = [...members]
    .filter((m) => m.phoneUsageEvents > 0)
    .sort((a, b) => b.phoneUsageEvents - a.phoneUsageEvents)[0];
  if (phoneRisk && phoneRisk.phoneUsageEvents >= 2) {
    parts.push(
      `${phoneRisk.displayName} had the phone in use ${phoneRisk.phoneUsageEvents}× while driving.`
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
        `Average Drive Score ${totals.avgDriveScore}/100 — check phone use and top speed.`
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
      phoneUsageEvents: true,
      driveScore: true,
      toLabel: true,
      endedAt: true,
      estimatedFuelCostCad: true,
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
      phoneUsageEvents: number;
      topSpeedKmh: number;
      scoreSum: number;
      fuelCostCad: number;
      destCounts: Map<string, number>;
      destArriveMinutes: Map<string, number[]>;
    }
  >();

  for (const id of opts.memberIds) {
    byMember.set(id, {
      driveCount: 0,
      distanceKm: 0,
      hardBraking: 0,
      rapidAcceleration: 0,
      unusualRouteEvents: 0,
      phoneUsageEvents: 0,
      topSpeedKmh: 0,
      scoreSum: 0,
      fuelCostCad: 0,
      destCounts: new Map(),
      destArriveMinutes: new Map(),
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
    row.phoneUsageEvents +=
      (t as { phoneUsageEvents?: number }).phoneUsageEvents ?? 0;
    row.scoreSum += t.driveScore ?? 0;
    row.fuelCostCad += t.estimatedFuelCostCad ?? 0;
    const dest = (t.toLabel ?? "").trim();
    if (dest && dest !== "In progress") {
      row.destCounts.set(dest, (row.destCounts.get(dest) ?? 0) + 1);
      if (t.endedAt) {
        const mins = t.endedAt.getHours() * 60 + t.endedAt.getMinutes();
        const list = row.destArriveMinutes.get(dest) ?? [];
        list.push(mins);
        row.destArriveMinutes.set(dest, list);
      }
    }
    const tripTop = sanitizeSpeedKmh(t.maxSpeedKmh) ?? 0;
    if (tripTop > row.topSpeedKmh) row.topSpeedKmh = tripTop;
    if (tripTop > topSpeedKmh) {
      topSpeedKmh = tripTop;
      topSpeedMemberId = t.memberId;
    }
    scoreSum += t.driveScore ?? 0;
  }

  function formatMinute(m: number): string {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    return `${h12}:${min.toString().padStart(2, "0")} ${ampm}`;
  }

  const members: DrivingReportMemberRow[] = opts.memberIds
    .map((id) => {
      const meta = opts.membersById.get(id)!;
      const row = byMember.get(id)!;
      // Risky = phone-in-use (trusted) — GPS brake/accel counters are paused.
      const risky = row.phoneUsageEvents;
      const learningNotes: string[] = [];
      const topDest = [...row.destCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topDest && topDest[1] >= 2) {
        const times = row.destArriveMinutes.get(topDest[0]) ?? [];
        if (times.length >= 2) {
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          learningNotes.push(
            `Often arrives at ${topDest[0]} around ${formatMinute(avg)} (${topDest[1]}× this week)`
          );
        } else {
          learningNotes.push(`Visited ${topDest[0]} most (${topDest[1]}× this week)`);
        }
      }
      if (row.distanceKm >= 5) {
        learningNotes.push(`Drove ${row.distanceKm.toFixed(1)} km across ${row.driveCount} trips`);
      }
      if (row.fuelCostCad > 0) {
        learningNotes.push(`About $${row.fuelCostCad.toFixed(2)} fuel this period`);
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
        riskyEvents: risky,
        topSpeedKmh: Math.round(row.topSpeedKmh),
        avgDriveScore:
          row.driveCount > 0 ? Math.round(row.scoreSum / row.driveCount) : null,
        learningNotes,
        estimatedFuelCostCad:
          row.fuelCostCad > 0 ? Number(row.fuelCostCad.toFixed(2)) : null,
      };
    })
    .filter((m) => m.driveCount > 0)
    .sort((a, b) => b.distanceKm - a.distanceKm);

  const phoneUsageEvents = trips.reduce(
    (a, t) => a + ((t as { phoneUsageEvents?: number }).phoneUsageEvents ?? 0),
    0
  );
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

  // Blend lasting place/time routines (midnight vs afternoon shifts, etc.).
  const routineRows = await prisma.familyRoutineStat.findMany({
    where: {
      memberId: { in: memberIds },
      sampleCount: { gte: 3 },
    },
    orderBy: [{ sampleCount: "desc" }],
    take: 40,
  });

  const membersWithRoutines = current.members.map((m) => {
    const notes = [...(m.learningNotes ?? [])];
    const routines = routineRows
      .filter((r) => r.memberId === m.memberId)
      .slice(0, 2);
    for (const r of routines) {
      if (r.usualArriveMinute == null) continue;
      const h = Math.floor(r.usualArriveMinute / 60) % 24;
      const min = r.usualArriveMinute % 60;
      const ampm = h >= 12 ? "pm" : "am";
      const h12 = h % 12 || 12;
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][r.dayOfWeek] ?? "";
      notes.push(
        `Learned: usually at ${r.placeName} ~${h12}:${min
          .toString()
          .padStart(2, "0")} ${ampm} on ${days}s (${r.sampleCount} samples)`
      );
    }
    return { ...m, learningNotes: notes.slice(0, 4) };
  });

  const learningBits = membersWithRoutines
    .flatMap((m) => (m.learningNotes ?? []).slice(0, 1).map((n) => `${m.displayName}: ${n}`))
    .slice(0, 2);
  const baseInsight = buildInsight(current.totals, membersWithRoutines, vsPrevious);
  const insight = [baseInsight, ...learningBits].filter(Boolean).join(" ");

  const memberInsights = membersWithRoutines.map((m) => ({
    memberId: m.memberId,
    displayName: m.displayName,
    summary:
      (m.learningNotes ?? []).slice(0, 2).join(" · ") ||
      `${m.driveCount} drives · ${m.distanceKm} km · top ${m.topSpeedKmh} km/h`,
  }));

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
  };
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

    // Idempotent: one "report ready" per household per week.
    const title = `Weekly driving report ready`;
    const since = addDays(startOfLocalMonday(), -1);
    const already = await prisma.notification.findFirst({
      where: {
        type: "family_weekly_drive_report",
        title,
        body: { contains: weekKey },
        createdAt: { gte: since },
        userId: { in: hh.members.map((m) => m.userId!).filter(Boolean) },
      },
      select: { id: true },
    });
    if (already) continue;

    for (const m of hh.members) {
      if (!m.userId) continue;
      const personal =
        report.memberInsights?.find((i) => i.memberId === m.id)?.summary ??
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

/**
 * Place intelligence — visit stats for a saved place with history-style ranges.
 */

import { prisma } from "@forward/database";
import { historyRangeStart, type HistoryRange } from "./history";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { getMemberForUser } from "./household";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type PlaceIntelVisit = {
  id: string;
  memberId: string;
  memberName: string;
  memberColor: string;
  arrivedAt: string;
  departedAt: string | null;
  dwellMinutes: number;
  isActive: boolean;
};

export type PlaceIntelStats = {
  placeId: string;
  placeName: string;
  range: HistoryRange;
  visitCount: number;
  averageDwellMinutes: number;
  lastVisitedAt: string | null;
  topVisitorName: string | null;
  topVisitorCount: number;
  busiestDayName: string | null;
  busiestDayCount: number;
  visitorBreakdown: Array<{
    memberId: string;
    displayName: string;
    color: string;
    visitCount: number;
    totalDwellMinutes: number;
  }>;
  visits: PlaceIntelVisit[];
};

export async function getPlaceIntelligence(opts: {
  viewerUserId: string;
  placeId: string;
  range: HistoryRange;
  tzOffsetMinutes?: number | null;
}): Promise<PlaceIntelStats> {
  await ensureFamilyMapSchema();
  const viewer = await getMemberForUser(opts.viewerUserId);
  if (!viewer) throw new Error("NO_HOUSEHOLD");

  const place = await prisma.familyPlace.findFirst({
    where: { id: opts.placeId, householdId: viewer.householdId },
    select: { id: true, name: true },
  });
  if (!place) throw new Error("NOT_FOUND");

  const members = await prisma.familyMember.findMany({
    where: { householdId: viewer.householdId, isSimulated: false },
    select: {
      id: true,
      displayName: true,
      color: true,
      sharePlaceHistory: true,
      locationSharingLevel: true,
    },
  });
  const memberById = new Map(members.map((m) => [m.id, m]));
  const memberIds = members.map((m) => m.id);
  const since = historyRangeStart(opts.range, opts.tzOffsetMinutes ?? null);

  const rows = await prisma.familyPlaceVisit.findMany({
    where: {
      memberId: { in: memberIds },
      arrivedAt: since ? { gte: since } : undefined,
      OR: [
        { placeId: place.id },
        { placeName: { equals: place.name, mode: "insensitive" } },
      ],
    },
    orderBy: { arrivedAt: "desc" },
    take: 120,
    select: {
      id: true,
      memberId: true,
      arrivedAt: true,
      departedAt: true,
      dwellMinutes: true,
      isActive: true,
    },
  });

  const canName = (memberId: string) => {
    const m = memberById.get(memberId);
    if (!m) return false;
    if (memberId === viewer.id) return true;
    if (!m.sharePlaceHistory) return false;
    return m.locationSharingLevel !== "off";
  };

  const byVisitor = new Map<
    string,
    { count: number; dwell: number; name: string; color: string }
  >();
  const byDay = new Map<number, number>();
  let dwellSum = 0;
  let dwellN = 0;

  const visits: PlaceIntelVisit[] = [];
  for (const row of rows) {
    const m = memberById.get(row.memberId);
    if (!m) continue;

    const named = canName(row.memberId);
    const displayName = named ? m.displayName : "Family member";

    // Always count for place rhythm; only list named stays in the timeline.
    const bucket = byVisitor.get(row.memberId) ?? {
      count: 0,
      dwell: 0,
      name: displayName,
      color: m.color,
    };
    bucket.count += 1;
    bucket.dwell += Math.max(0, row.dwellMinutes);
    if (named) bucket.name = m.displayName;
    byVisitor.set(row.memberId, bucket);

    const day = row.arrivedAt.getDay();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    if (row.dwellMinutes > 0) {
      dwellSum += row.dwellMinutes;
      dwellN += 1;
    }

    if (!named && row.memberId !== viewer.id) continue;
    visits.push({
      id: row.id,
      memberId: row.memberId,
      memberName: displayName,
      memberColor: m.color,
      arrivedAt: row.arrivedAt.toISOString(),
      departedAt: row.departedAt?.toISOString() ?? null,
      dwellMinutes: row.dwellMinutes,
      isActive: row.isActive,
    });
  }

  const visitorBreakdown = [...byVisitor.entries()]
    .map(([memberId, v]) => ({
      memberId,
      displayName: v.name,
      color: v.color,
      visitCount: v.count,
      totalDwellMinutes: v.dwell,
    }))
    .sort((a, b) => b.visitCount - a.visitCount);

  const top = visitorBreakdown[0] ?? null;
  let busiestDayName: string | null = null;
  let busiestDayCount = 0;
  for (const [day, count] of byDay) {
    if (count > busiestDayCount) {
      busiestDayCount = count;
      busiestDayName = DAY_NAMES[day] ?? null;
    }
  }

  return {
    placeId: place.id,
    placeName: place.name,
    range: opts.range,
    visitCount: rows.length,
    averageDwellMinutes: dwellN > 0 ? Math.round(dwellSum / dwellN) : 0,
    lastVisitedAt: rows[0]?.arrivedAt.toISOString() ?? null,
    topVisitorName: top?.displayName ?? null,
    topVisitorCount: top?.visitCount ?? 0,
    busiestDayName,
    busiestDayCount,
    visitorBreakdown,
    visits: visits.slice(0, 40),
  };
}

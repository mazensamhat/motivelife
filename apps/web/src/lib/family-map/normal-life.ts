import { prisma } from "@forward/database";
import type { FamilyMemberNormal } from "@forward/shared";
import { isWorkoutPlace } from "./workout-presence";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function formatMinuteClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = Math.abs(minuteOfDay % 60);
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function confidenceFromSamples(sampleCount: number, dayOfWeek: number): string {
  const day = DAY_NAMES[dayOfWeek] ?? "day";
  const n = Math.max(1, sampleCount);
  return `Based on ${n} ${day}${n === 1 ? "" : "s"}`;
}

/** Learn ordinary place/time patterns for Normal Life Model™. */
export async function learnPlaceVisit(opts: {
  memberId: string;
  placeName: string;
  at?: Date;
  dwellMinutes?: number;
}) {
  const at = opts.at ?? new Date();
  const dayOfWeek = at.getDay();
  const hourBucket = at.getHours();
  const minuteOfDay = at.getHours() * 60 + at.getMinutes();
  const dwell = Math.max(0, opts.dwellMinutes ?? 0);

  const existing = await prisma.familyRoutineStat.findUnique({
    where: {
      memberId_placeName_dayOfWeek_hourBucket: {
        memberId: opts.memberId,
        placeName: opts.placeName,
        dayOfWeek,
        hourBucket,
      },
    },
  });

  if (!existing) {
    await prisma.familyRoutineStat.create({
      data: {
        memberId: opts.memberId,
        placeName: opts.placeName,
        dayOfWeek,
        hourBucket,
        sampleCount: 1,
        totalDwellMin: dwell,
        usualArriveMinute: minuteOfDay,
      },
    });
    return;
  }

  const n = existing.sampleCount + 1;
  const prevArrive = existing.usualArriveMinute ?? minuteOfDay;
  const usualArriveMinute = Math.round((prevArrive * existing.sampleCount + minuteOfDay) / n);

  await prisma.familyRoutineStat.update({
    where: { id: existing.id },
    data: {
      sampleCount: n,
      totalDwellMin: existing.totalDwellMin + dwell,
      usualArriveMinute,
    },
  });
}

export async function learnPlaceLeave(opts: {
  memberId: string;
  placeName: string;
  at?: Date;
}) {
  const at = opts.at ?? new Date();
  const dayOfWeek = at.getDay();
  const hourBucket = at.getHours();
  const minuteOfDay = at.getHours() * 60 + at.getMinutes();

  const existing = await prisma.familyRoutineStat.findUnique({
    where: {
      memberId_placeName_dayOfWeek_hourBucket: {
        memberId: opts.memberId,
        placeName: opts.placeName,
        dayOfWeek,
        hourBucket,
      },
    },
  });
  if (!existing) return;

  const n = Math.max(1, existing.sampleCount);
  const prev = existing.usualLeaveMinute ?? minuteOfDay;
  const usualLeaveMinute = Math.round((prev * (n - 1) + minuteOfDay) / n);

  await prisma.familyRoutineStat.update({
    where: { id: existing.id },
    data: { usualLeaveMinute },
  });
}

type LateCheck = {
  unusual: boolean;
  usualLeaveLabel: string | null;
  sampleCount: number;
  usualLeaveMinute: number | null;
};

/** True when still at a place past the learned leave window (+ buffer). */
export async function isUnusuallyLateAtPlace(opts: {
  memberId: string;
  placeName: string;
  at?: Date;
  bufferMinutes?: number;
}): Promise<LateCheck> {
  const empty: LateCheck = {
    unusual: false,
    usualLeaveLabel: null,
    sampleCount: 0,
    usualLeaveMinute: null,
  };
  const at = opts.at ?? new Date();
  const dayOfWeek = at.getDay();
  const rows = await prisma.familyRoutineStat.findMany({
    where: {
      memberId: opts.memberId,
      placeName: opts.placeName,
      dayOfWeek,
      sampleCount: { gte: 4 },
      usualLeaveMinute: { not: null },
    },
  });
  if (rows.length === 0) return empty;

  const leaves = rows
    .map((r) => ({ minute: r.usualLeaveMinute!, samples: r.sampleCount }))
    .filter((n) => n.minute != null);
  // Daytime commute window only — overnight leave averages (e.g. 1:34 AM) were
  // false-positive "something's different" for the rest of the day.
  const daytime = leaves.filter((m) => m.minute >= 5 * 60 && m.minute <= 14 * 60);
  const usable =
    daytime.length > 0
      ? daytime
      : leaves.filter((m) => m.minute >= 5 * 60 && m.minute <= 21 * 60);
  if (usable.length === 0) return empty;

  const sampleCount = usable.reduce((a, b) => a + b.samples, 0);
  const avg = Math.round(usable.reduce((a, b) => a + b.minute, 0) / usable.length);
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const buffer = opts.bufferMinutes ?? 35;
  // Only flag for a few hours after the usual leave — not all afternoon/evening.
  const unusual = nowMin > avg + buffer && nowMin < avg + buffer + 4 * 60;

  return {
    unusual,
    usualLeaveLabel: formatMinuteClock(avg),
    sampleCount,
    usualLeaveMinute: avg,
  };
}

export type NormalMemberInput = {
  id: string;
  displayName: string;
  placeName: string | null;
  presence: string;
  shareRoutineLearning?: boolean;
};

/**
 * Per-person Normal Life™ cards for Family Intelligence — from FamilyRoutineStat.
 * No new tables; gated by shareRoutineLearning on each member.
 */
export async function summarizeHouseholdNormal(opts: {
  members: NormalMemberInput[];
  at?: Date;
  /** Member ids currently flagged as unusually late (status = unusual). */
  unusualMemberIds?: Set<string>;
}): Promise<FamilyMemberNormal[]> {
  const at = opts.at ?? new Date();
  const dayOfWeek = at.getDay();
  const dayName = DAY_NAMES[dayOfWeek] ?? "today";
  const learners = opts.members.filter((m) => m.shareRoutineLearning !== false);
  if (learners.length === 0) return [];

  const rows = await prisma.familyRoutineStat.findMany({
    where: {
      memberId: { in: learners.map((m) => m.id) },
      dayOfWeek,
      sampleCount: { gte: 2 },
    },
    orderBy: [{ sampleCount: "desc" }],
    take: 80,
  });

  const byMember = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byMember.get(r.memberId) ?? [];
    list.push(r);
    byMember.set(r.memberId, list);
  }

  return learners.map((m) => {
    const memberRows = byMember.get(m.id) ?? [];
    const atPlace =
      m.placeName != null
        ? memberRows.filter(
            (r) => r.placeName.toLowerCase() === m.placeName!.toLowerCase()
          )
        : [];
    const pool = atPlace.length > 0 ? atPlace : memberRows;

    // Prefer leave windows for daytime "normal", else arrive.
    const withLeave = pool.filter(
      (r) =>
        r.usualLeaveMinute != null &&
        r.usualLeaveMinute >= 5 * 60 &&
        r.usualLeaveMinute <= 21 * 60
    );
    const withArrive = pool.filter((r) => r.usualArriveMinute != null);
    const pick =
      withLeave.sort((a, b) => b.sampleCount - a.sampleCount)[0] ??
      withArrive.sort((a, b) => b.sampleCount - a.sampleCount)[0] ??
      null;

    if (!pick) {
      return {
        memberId: m.id,
        displayName: m.displayName,
        placeName: m.placeName,
        usualArriveLabel: null,
        usualLeaveLabel: null,
        sampleCount: 0,
        status: "learning" as const,
        line: `Still learning ${m.displayName.split(" ")[0]}’s ${dayName} rhythm`,
      };
    }

    const usualArriveLabel =
      pick.usualArriveMinute != null ? formatMinuteClock(pick.usualArriveMinute) : null;
    const usualLeaveLabel =
      pick.usualLeaveMinute != null ? formatMinuteClock(pick.usualLeaveMinute) : null;
    const sampleCount = pick.sampleCount;
    const unusual = opts.unusualMemberIds?.has(m.id) ?? false;
    const status: FamilyMemberNormal["status"] =
      unusual ? "unusual" : sampleCount < 4 ? "learning" : "normal";

    let line: string;
    const first = m.displayName.split(/\s+/)[0] ?? m.displayName;
    const workoutSpot = isWorkoutPlace({ placeName: pick.placeName });
    if (unusual && usualLeaveLabel) {
      line = workoutSpot
        ? `${first} usually wraps up at ${pick.placeName} around ${usualLeaveLabel} — still there`
        : `Usually leaves ${pick.placeName} around ${usualLeaveLabel} — still there`;
    } else if (usualLeaveLabel && m.placeName?.toLowerCase() === pick.placeName.toLowerCase()) {
      line = workoutSpot
        ? `${first}’s usual workout at ${pick.placeName} wraps around ${usualLeaveLabel}`
        : `Usually leaves ${pick.placeName} around ${usualLeaveLabel}`;
    } else if (usualArriveLabel && workoutSpot) {
      line = `${first} usually works out at ${pick.placeName} around ${usualArriveLabel} on ${dayName}s`;
    } else if (usualArriveLabel) {
      line = `Usually at ${pick.placeName} around ${usualArriveLabel} on ${dayName}s`;
    } else if (usualLeaveLabel) {
      line = `Usually leaves ${pick.placeName} around ${usualLeaveLabel}`;
    } else {
      line = `Learning ${pick.placeName} on ${dayName}s`;
    }

    return {
      memberId: m.id,
      displayName: m.displayName,
      placeName: pick.placeName,
      usualArriveLabel,
      usualLeaveLabel,
      sampleCount,
      status,
      line,
    };
  });
}

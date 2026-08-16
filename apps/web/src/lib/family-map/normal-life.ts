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

/** Round to nearest 15 minutes — avoids fake-precise "5:28 PM" from thin samples. */
export function formatMinuteClockLoose(minuteOfDay: number): string {
  const rounded = Math.round(minuteOfDay / 15) * 15;
  const wrapped = ((rounded % (24 * 60)) + 24 * 60) % (24 * 60);
  return formatMinuteClock(wrapped);
}

/** Minimum weekday samples before we ever say "usually … by X". */
export const ROUTINE_READY_SAMPLES = 5;

export function confidenceFromSamples(sampleCount: number, dayOfWeek: number): string {
  const day = DAY_NAMES[dayOfWeek] ?? "day";
  const n = Math.max(1, sampleCount);
  return `Based on ${n} ${day}${n === 1 ? "" : "s"}`;
}

/** Habitual arrive places for this member at the current day/hour window. */
export async function habitualDestinationsFor(opts: {
  memberId: string;
  dayOfWeek: number;
  hour: number;
  /** Prefer rows with at least this many samples (default 3 — early learning). */
  minSamples?: number;
}): Promise<Array<{ placeName: string; sampleCount: number; score: number }>> {
  const minSamples = opts.minSamples ?? 3;
  const hour = opts.hour;
  const day = opts.dayOfWeek;
  const hours = [(hour + 23) % 24, hour, (hour + 1) % 24];
  const rows = await prisma.familyRoutineStat.findMany({
    where: {
      memberId: opts.memberId,
      dayOfWeek: day,
      hourBucket: { in: hours },
      sampleCount: { gte: minSamples },
    },
    select: {
      placeName: true,
      sampleCount: true,
      hourBucket: true,
      usualArriveMinute: true,
    },
    take: 40,
  });
  const byPlace = new Map<string, { placeName: string; sampleCount: number; score: number }>();
  for (const row of rows) {
    const hourGap = Math.min(
      Math.abs(row.hourBucket - hour),
      24 - Math.abs(row.hourBucket - hour)
    );
    const hourW = hourGap === 0 ? 1 : hourGap === 1 ? 0.65 : 0.35;
    const score = row.sampleCount * hourW;
    const prev = byPlace.get(row.placeName);
    if (!prev || score > prev.score) {
      byPlace.set(row.placeName, {
        placeName: row.placeName,
        sampleCount: row.sampleCount,
        score,
      });
    } else {
      prev.sampleCount = Math.max(prev.sampleCount, row.sampleCount);
      prev.score += score * 0.35;
    }
  }
  return [...byPlace.values()].sort((a, b) => b.score - a.score);
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
      sampleCount: { gte: ROUTINE_READY_SAMPLES },
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
  if (sampleCount < ROUTINE_READY_SAMPLES) return empty;
  const avg = Math.round(usable.reduce((a, b) => a + b.minute, 0) / usable.length);
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const buffer = opts.bufferMinutes ?? 35;
  // Only flag for a few hours after the usual leave — not all afternoon/evening.
  const unusual = nowMin > avg + buffer && nowMin < avg + buffer + 4 * 60;

  return {
    unusual,
    usualLeaveLabel: formatMinuteClockLoose(avg),
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
        leaveInMinutes: null,
        sampleCount: 0,
        status: "learning" as const,
        line: `Still learning ${m.displayName.split(" ")[0]}’s ${dayName} rhythm`,
      };
    }

    const sampleCount = pick.sampleCount;
    const unusual = opts.unusualMemberIds?.has(m.id) ?? false;
    const ready = sampleCount >= ROUTINE_READY_SAMPLES;
    const status: FamilyMemberNormal["status"] =
      unusual && ready ? "unusual" : ready ? "normal" : "learning";

    const usualArriveLabel =
      ready && pick.usualArriveMinute != null
        ? formatMinuteClockLoose(pick.usualArriveMinute)
        : null;
    const usualLeaveLabel =
      ready && pick.usualLeaveMinute != null
        ? formatMinuteClockLoose(pick.usualLeaveMinute)
        : null;

    // Coming-up leave countdown only when they're still at this place.
    let leaveInMinutes: number | null = null;
    if (
      ready &&
      pick.usualLeaveMinute != null &&
      m.presence === "stationary" &&
      m.placeName &&
      m.placeName.toLowerCase() === pick.placeName.toLowerCase()
    ) {
      const nowMin = at.getHours() * 60 + at.getMinutes();
      const delta = pick.usualLeaveMinute - nowMin;
      if (delta >= 0 && delta <= 90) leaveInMinutes = delta;
    }

    const avgDwellMin =
      pick.sampleCount > 0 ? Math.round(pick.totalDwellMin / pick.sampleCount) : 0;
    const shiftLabel =
      ready && avgDwellMin >= 90
        ? avgDwellMin >= 60
          ? `~${Math.round(avgDwellMin / 60)}h shifts`
          : `~${avgDwellMin} min stays`
        : null;
    const isWorkPlace =
      /work|plant|factory|office|job/i.test(pick.placeName) ||
      (m.placeName != null &&
        /work|plant|factory|office/i.test(m.placeName) &&
        m.placeName.toLowerCase() === pick.placeName.toLowerCase());

    let line: string;
    const first = m.displayName.split(/\s+/)[0] ?? m.displayName;
    const workoutSpot = isWorkoutPlace({ placeName: pick.placeName });
    // Never invent "usually by 5:28" while still learning — only confident normals.
    if (!ready) {
      line = `Still learning ${first}’s ${dayName} rhythm${
        pick.placeName ? ` at ${pick.placeName}` : ""
      }`;
    } else if (unusual && usualLeaveLabel) {
      line = workoutSpot
        ? `${first} usually wraps up at ${pick.placeName} around ${usualLeaveLabel} — still there`
        : isWorkPlace
          ? `${first}’s usual shift at ${pick.placeName} wraps around ${usualLeaveLabel} — still there`
          : `Usually leaves ${pick.placeName} around ${usualLeaveLabel} — still there`;
    } else if (usualLeaveLabel && m.placeName?.toLowerCase() === pick.placeName.toLowerCase()) {
      line = workoutSpot
        ? `${first}’s usual workout at ${pick.placeName} wraps around ${usualLeaveLabel}`
        : isWorkPlace && shiftLabel
          ? `${first} usually works at ${pick.placeName} until ~${usualLeaveLabel} (${shiftLabel})`
          : `Usually leaves ${pick.placeName} around ${usualLeaveLabel}`;
    } else if (usualArriveLabel && workoutSpot) {
      line = `${first} usually works out at ${pick.placeName} around ${usualArriveLabel} on ${dayName}s`;
    } else if (usualArriveLabel && isWorkPlace && shiftLabel) {
      line = `${first} usually starts at ${pick.placeName} around ${usualArriveLabel} · ${shiftLabel}`;
    } else if (usualArriveLabel) {
      line = `Usually at ${pick.placeName} around ${usualArriveLabel} on ${dayName}s`;
    } else if (usualLeaveLabel) {
      line = `Usually leaves ${pick.placeName} around ${usualLeaveLabel}`;
    } else {
      line = `Still learning ${first}’s ${dayName} rhythm`;
    }

    return {
      memberId: m.id,
      displayName: m.displayName,
      placeName: pick.placeName,
      usualArriveLabel,
      usualLeaveLabel,
      leaveInMinutes,
      sampleCount,
      status,
      line,
    };
  });
}

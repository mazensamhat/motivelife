import { prisma } from "@forward/database";

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

/** True when still at a place past the learned leave window (+ buffer). */
export async function isUnusuallyLateAtPlace(opts: {
  memberId: string;
  placeName: string;
  at?: Date;
  bufferMinutes?: number;
}): Promise<{ unusual: boolean; usualLeaveLabel: string | null }> {
  const at = opts.at ?? new Date();
  const dayOfWeek = at.getDay();
  const rows = await prisma.familyRoutineStat.findMany({
    where: {
      memberId: opts.memberId,
      placeName: opts.placeName,
      dayOfWeek,
      sampleCount: { gte: 3 },
      usualLeaveMinute: { not: null },
    },
  });
  if (rows.length === 0) return { unusual: false, usualLeaveLabel: null };

  const leaves = rows.map((r) => r.usualLeaveMinute!).filter((n) => n != null);
  const avg = Math.round(leaves.reduce((a, b) => a + b, 0) / leaves.length);
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const buffer = opts.bufferMinutes ?? 25;
  const unusual = nowMin > avg + buffer;

  const h = Math.floor(avg / 60);
  const m = avg % 60;
  const usualLeaveLabel = `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;

  return { unusual, usualLeaveLabel };
}

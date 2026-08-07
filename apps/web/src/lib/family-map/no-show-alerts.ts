/**
 * No Show Alerts — notify if a member isn’t at a place by a set local time.
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { wantsFamilyAlert } from "./alert-prefs";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { haversineKm } from "@forward/shared";

export type NoShowAlertView = {
  id: string;
  memberId: string;
  placeId: string;
  placeName: string;
  byTimeLocal: string; // "17:30"
  enabled: boolean;
};

async function ensureNoShowTable() {
  await ensureFamilyMapSchema();
  try {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyNoShowAlert" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "byTimeLocal" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredOn" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyNoShowAlert_pkey" PRIMARY KEY ("id")
)`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "FamilyNoShowAlert_householdId_idx" ON "FamilyNoShowAlert"("householdId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "FamilyNoShowAlert_memberId_idx" ON "FamilyNoShowAlert"("memberId")`
    );
  } catch {
    // exists
  }
}

function newId() {
  return `nsa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function listNoShowAlerts(householdId: string): Promise<NoShowAlertView[]> {
  await ensureNoShowTable();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT a."id", a."memberId", a."placeId", a."byTimeLocal", a."enabled", p."name" as "placeName"
     FROM "FamilyNoShowAlert" a
     JOIN "FamilyPlace" p ON p."id" = a."placeId"
     WHERE a."householdId" = $1
     ORDER BY a."byTimeLocal" ASC`,
    householdId
  )) as Array<{
    id: string;
    memberId: string;
    placeId: string;
    byTimeLocal: string;
    enabled: boolean;
    placeName: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    memberId: r.memberId,
    placeId: r.placeId,
    placeName: r.placeName,
    byTimeLocal: r.byTimeLocal,
    enabled: r.enabled,
  }));
}

export async function upsertNoShowAlert(opts: {
  householdId: string;
  memberId: string;
  placeId: string;
  byTimeLocal: string;
  enabled?: boolean;
}): Promise<NoShowAlertView> {
  await ensureNoShowTable();
  const time = opts.byTimeLocal.trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) throw new Error("INVALID_TIME");

  const existing = (await prisma.$queryRawUnsafe(
    `SELECT "id" FROM "FamilyNoShowAlert"
     WHERE "householdId" = $1 AND "memberId" = $2 AND "placeId" = $3
     LIMIT 1`,
    opts.householdId,
    opts.memberId,
    opts.placeId
  )) as Array<{ id: string }>;

  const enabled = opts.enabled !== false;
  const now = new Date().toISOString();

  if (existing[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE "FamilyNoShowAlert"
       SET "byTimeLocal" = $1, "enabled" = $2, "updatedAt" = $3::timestamp
       WHERE "id" = $4`,
      time,
      enabled,
      now,
      existing[0].id
    );
    const place = await prisma.familyPlace.findUnique({
      where: { id: opts.placeId },
      select: { name: true },
    });
    return {
      id: existing[0].id,
      memberId: opts.memberId,
      placeId: opts.placeId,
      placeName: place?.name ?? "Place",
      byTimeLocal: time,
      enabled,
    };
  }

  const id = newId();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FamilyNoShowAlert"
      ("id", "householdId", "memberId", "placeId", "byTimeLocal", "enabled", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $7::timestamp)`,
    id,
    opts.householdId,
    opts.memberId,
    opts.placeId,
    time,
    enabled,
    now
  );
  const place = await prisma.familyPlace.findUnique({
    where: { id: opts.placeId },
    select: { name: true },
  });
  return {
    id,
    memberId: opts.memberId,
    placeId: opts.placeId,
    placeName: place?.name ?? "Place",
    byTimeLocal: time,
    enabled,
  };
}

export async function deleteNoShowAlert(opts: { id: string; householdId: string }) {
  await ensureNoShowTable();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "FamilyNoShowAlert" WHERE "id" = $1 AND "householdId" = $2`,
    opts.id,
    opts.householdId
  );
}

/** Fire once per calendar day when past byTime and member not near place. */
export async function evaluateNoShowAlerts(opts: {
  householdId: string;
  notifyUserIds: string[];
}) {
  await ensureNoShowTable();
  const alerts = (await prisma.$queryRawUnsafe(
    `SELECT a.*, p."name" as "placeName", p."lat" as "placeLat", p."lng" as "placeLng", p."radiusM",
            m."displayName", m."lastLat", m."lastLng", m."currentPlaceId"
     FROM "FamilyNoShowAlert" a
     JOIN "FamilyPlace" p ON p."id" = a."placeId"
     JOIN "FamilyMember" m ON m."id" = a."memberId"
     WHERE a."householdId" = $1 AND a."enabled" = true`,
    opts.householdId
  )) as Array<{
    id: string;
    memberId: string;
    placeId: string;
    byTimeLocal: string;
    lastFiredOn: string | null;
    placeName: string;
    placeLat: number;
    placeLng: number;
    radiusM: number;
    displayName: string;
    lastLat: number | null;
    lastLng: number | null;
    currentPlaceId: string | null;
  }>;

  if (alerts.length === 0) return;

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const minsNow = now.getHours() * 60 + now.getMinutes();

  for (const a of alerts) {
    const [hh, mm] = a.byTimeLocal.split(":").map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    const byMins = hh * 60 + mm;
    if (minsNow < byMins) continue;
    if (a.lastFiredOn === todayKey) continue;

    const atPlace =
      a.currentPlaceId === a.placeId ||
      (a.lastLat != null &&
        a.lastLng != null &&
        haversineKm(a.lastLat, a.lastLng, a.placeLat, a.placeLng) * 1000 <=
          Math.max(80, a.radiusM));

    if (atPlace) continue;

    await prisma.$executeRawUnsafe(
      `UPDATE "FamilyNoShowAlert" SET "lastFiredOn" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
      todayKey,
      a.id
    );

    const recipients = await prisma.familyMember.findMany({
      where: {
        householdId: opts.householdId,
        userId: { in: opts.notifyUserIds },
        isSimulated: false,
      },
      select: {
        userId: true,
        alertNoShow: true,
      },
    });

    for (const recipient of recipients) {
      if (!recipient.userId) continue;
      if (!wantsFamilyAlert(recipient, "no_show")) continue;
      await createNotification({
        userId: recipient.userId,
        type: "family_no_show",
        title: `No show · ${a.displayName}`,
        body: `${a.displayName} wasn’t at ${a.placeName} by ${a.byTimeLocal}. A calm check-in might help.`,
        href: "/family-map",
      });
    }
  }
}

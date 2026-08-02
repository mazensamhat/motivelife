import { prisma } from "@forward/database";

let ensured: Promise<void> | null = null;

/**
 * Production may lag behind prisma db:push. Create Family Map tables if missing
 * so /family-map works after deploy without a manual SQL step.
 */
export function ensureFamilyMapSchema(): Promise<void> {
  if (!ensured) {
    ensured = createTables().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

async function createTables() {
  // Probe — if this works, schema is ready.
  try {
    await prisma.familyHousehold.findFirst({ take: 1 });
    return;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!/does not exist|P2021|P2010/i.test(msg)) throw error;
  }

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyHousehold" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'My Family',
  "inviteCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyHousehold_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "FamilyHousehold_ownerUserId_key" ON "FamilyHousehold"("ownerUserId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "FamilyHousehold_inviteCode_key" ON "FamilyHousehold"("inviteCode")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyHousehold_inviteCode_idx" ON "FamilyHousehold"("inviteCode")`
  );

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyMember" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "userId" TEXT,
  "displayName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "color" TEXT NOT NULL DEFAULT '#00c6ff',
  "locationSharingLevel" TEXT NOT NULL DEFAULT 'precise',
  "shareDrivingData" BOOLEAN NOT NULL DEFAULT true,
  "sharePlaceHistory" BOOLEAN NOT NULL DEFAULT true,
  "shareRoutineLearning" BOOLEAN NOT NULL DEFAULT true,
  "shareFamilyInsights" BOOLEAN NOT NULL DEFAULT true,
  "isSimulated" BOOLEAN NOT NULL DEFAULT false,
  "simRouteKey" TEXT,
  "lastLat" DOUBLE PRECISION,
  "lastLng" DOUBLE PRECISION,
  "lastAccuracyM" DOUBLE PRECISION,
  "lastSpeedKmh" DOUBLE PRECISION,
  "lastHeadingDeg" DOUBLE PRECISION,
  "lastBatteryPercent" INTEGER,
  "lastLocationAt" TIMESTAMP(3),
  "presenceStatus" TEXT NOT NULL DEFAULT 'unknown',
  "statusLabel" TEXT,
  "currentPlaceId" TEXT,
  "likelyDestination" TEXT,
  "destinationConfidence" DOUBLE PRECISION,
  "etaMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyMember_householdId_idx" ON "FamilyMember"("householdId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyMember_userId_idx" ON "FamilyMember"("userId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "FamilyMember_householdId_userId_key" ON "FamilyMember"("householdId", "userId")`
  );

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyPlace" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "radiusM" DOUBLE PRECISION NOT NULL DEFAULT 120,
  "category" TEXT NOT NULL DEFAULT 'other',
  "visitCount" INTEGER NOT NULL DEFAULT 0,
  "totalDwellMin" INTEGER NOT NULL DEFAULT 0,
  "lastVisitedAt" TIMESTAMP(3),
  "mostCommonVisitorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyPlace_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyPlace_householdId_idx" ON "FamilyPlace"("householdId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "FamilyPlace_householdId_name_key" ON "FamilyPlace"("householdId", "name")`
  );

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyTrip" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "fromLabel" TEXT NOT NULL,
  "toLabel" TEXT NOT NULL DEFAULT 'In progress',
  "startLat" DOUBLE PRECISION NOT NULL,
  "startLng" DOUBLE PRECISION NOT NULL,
  "endLat" DOUBLE PRECISION,
  "endLng" DOUBLE PRECISION,
  "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "durationMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hardBraking" INTEGER NOT NULL DEFAULT 0,
  "rapidAcceleration" INTEGER NOT NULL DEFAULT 0,
  "unusualRouteEvents" INTEGER NOT NULL DEFAULT 0,
  "driveScore" INTEGER NOT NULL DEFAULT 90,
  "sampleCount" INTEGER NOT NULL DEFAULT 1,
  "speedSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyTrip_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyTrip_memberId_startedAt_idx" ON "FamilyTrip"("memberId", "startedAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyTrip_memberId_isActive_idx" ON "FamilyTrip"("memberId", "isActive")`
  );

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyLocationEvent" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "speedKmh" DOUBLE PRECISION,
  "headingDeg" DOUBLE PRECISION,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyLocationEvent_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyLocationEvent_memberId_recordedAt_idx" ON "FamilyLocationEvent"("memberId", "recordedAt")`
  );

  // FKs — ignore if already present
  const fks = [
    `ALTER TABLE "FamilyHousehold" ADD CONSTRAINT "FamilyHousehold_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "FamilyHousehold"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "FamilyPlace" ADD CONSTRAINT "FamilyPlace_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "FamilyHousehold"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "FamilyTrip" ADD CONSTRAINT "FamilyTrip_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "FamilyLocationEvent" ADD CONSTRAINT "FamilyLocationEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  ];
  for (const sql of fks) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // already exists
    }
  }
}

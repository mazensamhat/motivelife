import { prisma } from "@forward/database";

let ensured: Promise<void> | null = null;

/**
 * Production may lag behind prisma db:push. Create / alter Family Map + Circles
 * tables so /family-map works after deploy without a manual SQL step.
 */
export function ensureFamilyMapSchema(): Promise<void> {
  if (!ensured) {
    ensured = migrate().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

async function migrate() {
  // Fast path — already migrated (avoids DDL locks hanging mobile map loads)
  try {
    await prisma.$queryRaw`SELECT 1 FROM "LocationCircle" LIMIT 1`;
    await prisma.$queryRaw`SELECT "memberKind", "vehicleMake", "currentPlaceEnteredAt", "relationshipLabel", "shareDigitalTwinIntegration" FROM "FamilyMember" LIMIT 1`;
    await prisma.$queryRaw`SELECT "estimatedFuelCostCad" FROM "FamilyTrip" LIMIT 1`;
    await prisma.$queryRaw`SELECT "notifyOnEnter", "notifyOnLeave", "shape" FROM "FamilyPlace" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "FamilyPlaceVisit" LIMIT 1`;
    await prisma.$queryRaw`SELECT "lat", "lng" FROM "FamilyPlaceVisit" LIMIT 1`;
    return;
  } catch {
    // need create / alter
  }

  await createCoreTables();
  await applyAdditiveMigrations();
}

async function createCoreTables() {
  // Probe — if household works, core tables exist; still run additives below.
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
  "shareDigitalTwinIntegration" BOOLEAN NOT NULL DEFAULT true,
  "isSimulated" BOOLEAN NOT NULL DEFAULT false,
  "simRouteKey" TEXT,
  "memberKind" TEXT NOT NULL DEFAULT 'ADULT',
  "guardianUserId" TEXT,
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
  "shape" TEXT NOT NULL DEFAULT 'circle',
  "notifyOnEnter" BOOLEAN NOT NULL DEFAULT true,
  "notifyOnLeave" BOOLEAN NOT NULL DEFAULT true,
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

/** Columns / tables added after the original Family Map ship. Safe to re-run. */
async function applyAdditiveMigrations() {
  const alters = [
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "memberKind" TEXT NOT NULL DEFAULT 'ADULT'`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "guardianUserId" TEXT`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "relationshipLabel" TEXT`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "vehicleMake" TEXT`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "vehicleModel" TEXT`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "vehicleYear" INTEGER`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "fuelType" TEXT`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "engineSummary" TEXT`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "litresPer100km" DOUBLE PRECISION`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "kwhPer100km" DOUBLE PRECISION`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "fuelPriceCadPerLitre" DOUBLE PRECISION DEFAULT 1.55`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "evPriceCadPerKwh" DOUBLE PRECISION DEFAULT 0.14`,
    `ALTER TABLE "FamilyTrip" ADD COLUMN IF NOT EXISTS "estimatedFuelLitres" DOUBLE PRECISION`,
    `ALTER TABLE "FamilyTrip" ADD COLUMN IF NOT EXISTS "estimatedFuelKwh" DOUBLE PRECISION`,
    `ALTER TABLE "FamilyTrip" ADD COLUMN IF NOT EXISTS "estimatedFuelCostCad" DOUBLE PRECISION`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "shareDigitalTwinIntegration" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "FamilyPlace" ADD COLUMN IF NOT EXISTS "notifyOnEnter" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "FamilyPlace" ADD COLUMN IF NOT EXISTS "notifyOnLeave" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "FamilyPlace" ADD COLUMN IF NOT EXISTS "shape" TEXT NOT NULL DEFAULT 'circle'`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "currentPlaceEnteredAt" TIMESTAMP(3)`,
    `ALTER TABLE "FamilyPlaceVisit" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION`,
    `ALTER TABLE "FamilyPlaceVisit" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION`,
  ];
  for (const sql of alters) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // column may already exist on older Postgres without IF NOT EXISTS
    }
  }

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyPlaceVisit" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "placeId" TEXT,
  "placeName" TEXT NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "arrivedAt" TIMESTAMP(3) NOT NULL,
  "departedAt" TIMESTAMP(3),
  "dwellMinutes" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyPlaceVisit_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyPlaceVisit_memberId_arrivedAt_idx" ON "FamilyPlaceVisit"("memberId", "arrivedAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyPlaceVisit_memberId_isActive_idx" ON "FamilyPlaceVisit"("memberId", "isActive")`
  );
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "FamilyPlaceVisit" ADD CONSTRAINT "FamilyPlaceVisit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
  } catch {
    // already exists
  }

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "FamilyRoutineStat" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "placeName" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "hourBucket" INTEGER NOT NULL,
  "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "totalDwellMin" INTEGER NOT NULL DEFAULT 0,
  "usualLeaveMinute" INTEGER,
  "usualArriveMinute" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyRoutineStat_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "FamilyRoutineStat_memberId_placeName_dayOfWeek_hourBucket_key" ON "FamilyRoutineStat"("memberId", "placeName", "dayOfWeek", "hourBucket")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FamilyRoutineStat_memberId_placeName_idx" ON "FamilyRoutineStat"("memberId", "placeName")`
  );

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "LocationCircle" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "inviteCode" TEXT NOT NULL,
  "householdId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LocationCircle_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "LocationCircle_inviteCode_key" ON "LocationCircle"("inviteCode")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "LocationCircle_ownerUserId_idx" ON "LocationCircle"("ownerUserId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "LocationCircle_inviteCode_idx" ON "LocationCircle"("inviteCode")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "LocationCircle_type_idx" ON "LocationCircle"("type")`
  );

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "LocationCircleMember" (
  "id" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "userId" TEXT,
  "displayName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "sharingLevel" TEXT NOT NULL DEFAULT 'precise',
  "shareUntil" TIMESTAMP(3),
  "memberKind" TEXT NOT NULL DEFAULT 'ADULT',
  "color" TEXT NOT NULL DEFAULT '#22c55e',
  "lastLat" DOUBLE PRECISION,
  "lastLng" DOUBLE PRECISION,
  "lastBatteryPercent" INTEGER,
  "lastLocationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LocationCircleMember_pkey" PRIMARY KEY ("id")
)`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "LocationCircleMember_circleId_userId_key" ON "LocationCircleMember"("circleId", "userId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "LocationCircleMember_circleId_idx" ON "LocationCircleMember"("circleId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "LocationCircleMember_userId_idx" ON "LocationCircleMember"("userId")`
  );

  // Additive columns for circle members created before location fields
  const circleAlters = [
    `ALTER TABLE "LocationCircleMember" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '#22c55e'`,
    `ALTER TABLE "LocationCircleMember" ADD COLUMN IF NOT EXISTS "lastLat" DOUBLE PRECISION`,
    `ALTER TABLE "LocationCircleMember" ADD COLUMN IF NOT EXISTS "lastLng" DOUBLE PRECISION`,
    `ALTER TABLE "LocationCircleMember" ADD COLUMN IF NOT EXISTS "lastBatteryPercent" INTEGER`,
    `ALTER TABLE "LocationCircleMember" ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP(3)`,
  ];
  for (const sql of circleAlters) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // ignore
    }
  }

  const moreFks = [
    `ALTER TABLE "FamilyRoutineStat" ADD CONSTRAINT "FamilyRoutineStat_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "LocationCircle" ADD CONSTRAINT "LocationCircle_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "LocationCircleMember" ADD CONSTRAINT "LocationCircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "LocationCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "LocationCircleMember" ADD CONSTRAINT "LocationCircleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  ];
  for (const sql of moreFks) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // already exists
    }
  }
}

import { prisma } from "@forward/database";
import { executeDdl } from "@/lib/family-map/ddl";

let migrateInFlight: Promise<void> | null = null;
let schemaReady = false;

export function ensureVitaluSchema(): Promise<void> {
  if (schemaReady) return Promise.resolve();

  if (!migrateInFlight) {
    migrateInFlight = migrate()
      .then(() => {
        schemaReady = true;
      })
      .catch((error) => {
        console.error("[ensureVitaluSchema]", error);
      })
      .finally(() => {
        migrateInFlight = null;
      });
  }

  return Promise.race([
    migrateInFlight,
    new Promise<void>((resolve) => {
      setTimeout(resolve, 12_000);
    }),
  ]);
}

async function migrate() {
  try {
    await prisma.$queryRaw`SELECT "planIntent", "calorieTarget", "vaultShareVyra" FROM "HealthProfile" LIMIT 1`;
    await prisma.$queryRaw`SELECT "kg", "source" FROM "VitaluWeightLog" LIMIT 1`;
    return;
  } catch {
    // need create
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS "HealthProfile" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL UNIQUE,
      "biologicalSex" TEXT,
      "heightCm" DOUBLE PRECISION,
      "currentWeightKg" DOUBLE PRECISION,
      "goalWeightKg" DOUBLE PRECISION,
      "activityLevel" TEXT,
      "planIntent" TEXT,
      "units" TEXT NOT NULL DEFAULT 'METRIC',
      "calorieTarget" INTEGER,
      "proteinTargetG" INTEGER,
      "carbsTargetG" INTEGER,
      "fatTargetG" INTEGER,
      "waterTargetMl" INTEGER,
      "stepsTarget" INTEGER,
      "workoutsPerWeek" INTEGER,
      "vaultShareLifeGraph" BOOLEAN NOT NULL DEFAULT false,
      "vaultShareVyra" BOOLEAN NOT NULL DEFAULT false,
      "onboardingJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HealthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "VitaluWeightLog" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "kg" DOUBLE PRECISION NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'MANUAL',
      "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VitaluWeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VitaluWeightLog_userId_recordedAt_idx" ON "VitaluWeightLog"("userId", "recordedAt")`,
  ];

  for (const sql of statements) {
    try {
      await executeDdl(sql);
    } catch (error) {
      console.warn("[ensureVitaluSchema]", sql.slice(0, 72), error);
    }
  }
}

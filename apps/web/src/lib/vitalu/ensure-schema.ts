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
  const statements = [
    `ALTER TABLE "HealthProfile" ADD COLUMN IF NOT EXISTS "lastWorkoutFeedback" TEXT`,
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
      "lastWorkoutFeedback" TEXT,
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
    `CREATE TABLE IF NOT EXISTS "VitaluFoodLog" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "catalogId" TEXT,
      "title" TEXT NOT NULL,
      "mealSlot" TEXT NOT NULL,
      "grams" DOUBLE PRECISION NOT NULL,
      "kcal" DOUBLE PRECISION NOT NULL,
      "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "fiberG" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "waterMl" INTEGER NOT NULL DEFAULT 0,
      "eatenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VitaluFoodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VitaluFoodLog_userId_eatenAt_idx" ON "VitaluFoodLog"("userId", "eatenAt")`,
    `CREATE TABLE IF NOT EXISTS "VitaluWorkout" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "minutes" INTEGER NOT NULL,
      "equipment" TEXT NOT NULL DEFAULT 'NONE',
      "sessionJson" TEXT NOT NULL,
      "plannedFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "feedback" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VitaluWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VitaluWorkout_userId_plannedFor_idx" ON "VitaluWorkout"("userId", "plannedFor")`,
    `CREATE TABLE IF NOT EXISTS "VitaluSavedMeal" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "mealSlot" TEXT NOT NULL,
      "itemsJson" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VitaluSavedMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VitaluSavedMeal_userId_mealSlot_idx" ON "VitaluSavedMeal"("userId", "mealSlot")`,
  ];

  for (const sql of statements) {
    try {
      await executeDdl(sql);
    } catch (error) {
      console.warn("[ensureVitaluSchema]", sql.slice(0, 72), error);
    }
  }
}

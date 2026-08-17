import { prisma } from "@forward/database";
import { executeDdl } from "@/lib/family-map/ddl";

let migrateInFlight: Promise<void> | null = null;
let schemaReady = false;

/**
 * Production may lag behind prisma db:push. Ensure Kashu columns/tables exist
 * so /api/kashu works after deploy without a manual push from this agent.
 */
export function ensureKashuSchema(): Promise<void> {
  if (schemaReady) return Promise.resolve();

  if (!migrateInFlight) {
    migrateInFlight = migrate()
      .then(() => {
        schemaReady = true;
      })
      .catch((error) => {
        console.error("[ensureKashuSchema]", error);
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
  // Always attempt Phase 3 income-band columns (IF NOT EXISTS is cheap).
  for (const sql of [
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "incomeKind" TEXT DEFAULT 'FIXED'`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "incomeConservative" DOUBLE PRECISION`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "incomeHigh" DOUBLE PRECISION`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "kashuLearningJson" TEXT`,
    `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "targetAmount" DOUBLE PRECISION`,
    `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "monthlyContribution" DOUBLE PRECISION`,
  ]) {
    try {
      await executeDdl(sql);
    } catch (error) {
      console.warn("[ensureKashuSchema]", sql.slice(0, 72), error);
    }
  }

  try {
    await prisma.$queryRaw`SELECT "liquidBalance", "safetyFloor", "emergencyReserve", "payFrequency", "nextPayday", "paydayAnchorDay", "lifestyleBurnDaily", "transitionJson", "incomeKind", "incomeConservative", "incomeHigh", "kashuLearningJson" FROM "FinancialProfile" LIMIT 1`;
    await prisma.$queryRaw`SELECT "targetAmount", "monthlyContribution" FROM "Goal" LIMIT 1`;
    await prisma.$queryRaw`SELECT "frequency", "intervalDays", "nextDueDate", "priority", "confidence", "source" FROM "MoneyItem" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "KashuStatement" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "KashuTransaction" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "KashuRecurringCandidate" LIMIT 1`;
    return;
  } catch {
    // need create / alter
  }

  const statements = [
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "liquidBalance" DOUBLE PRECISION`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "safetyFloor" DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "emergencyReserve" DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "payFrequency" TEXT`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "nextPayday" TIMESTAMP(3)`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "paydayAnchorDay" INTEGER`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "lifestyleBurnDaily" DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "incomeKind" TEXT DEFAULT 'FIXED'`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "incomeConservative" DOUBLE PRECISION`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "incomeHigh" DOUBLE PRECISION`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "transitionJson" TEXT`,
    `ALTER TABLE "FinancialProfile" ADD COLUMN IF NOT EXISTS "kashuLearningJson" TEXT`,
    `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "targetAmount" DOUBLE PRECISION`,
    `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "monthlyContribution" DOUBLE PRECISION`,

    `ALTER TABLE "MoneyItem" ADD COLUMN IF NOT EXISTS "frequency" TEXT DEFAULT 'MONTHLY'`,
    `ALTER TABLE "MoneyItem" ADD COLUMN IF NOT EXISTS "intervalDays" INTEGER`,
    `ALTER TABLE "MoneyItem" ADD COLUMN IF NOT EXISTS "nextDueDate" TIMESTAMP(3)`,
    `ALTER TABLE "MoneyItem" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'MANDATORY'`,
    `ALTER TABLE "MoneyItem" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION`,
    `ALTER TABLE "MoneyItem" ADD COLUMN IF NOT EXISTS "source" TEXT`,

    `CREATE TABLE IF NOT EXISTS "KashuStatement" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
      "blobPath" TEXT,
      "rawText" TEXT NOT NULL,
      "parsedJson" TEXT,
      "status" TEXT NOT NULL DEFAULT 'parsed',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "KashuStatement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "KashuStatement_userId_createdAt_idx" ON "KashuStatement"("userId", "createdAt")`,

    `CREATE TABLE IF NOT EXISTS "KashuTransaction" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "statementId" TEXT,
      "postedAt" TIMESTAMP(3) NOT NULL,
      "description" TEXT NOT NULL,
      "merchantNorm" TEXT,
      "amount" DOUBLE PRECISION NOT NULL,
      "direction" TEXT NOT NULL,
      "balanceAfter" DOUBLE PRECISION,
      "classification" TEXT,
      "isTransfer" BOOLEAN NOT NULL DEFAULT false,
      "isOneOff" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "KashuTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "KashuTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "KashuStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "KashuTransaction_userId_postedAt_idx" ON "KashuTransaction"("userId", "postedAt")`,
    `CREATE INDEX IF NOT EXISTS "KashuTransaction_userId_merchantNorm_idx" ON "KashuTransaction"("userId", "merchantNorm")`,

    `CREATE TABLE IF NOT EXISTS "KashuRecurringCandidate" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "merchantNorm" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "amountMin" DOUBLE PRECISION,
      "amountMax" DOUBLE PRECISION,
      "frequency" TEXT NOT NULL,
      "intervalDays" INTEGER,
      "nextDueDate" TIMESTAMP(3),
      "priority" TEXT NOT NULL DEFAULT 'MANDATORY',
      "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      "autoPay" BOOLEAN NOT NULL DEFAULT false,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "moneyItemId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "KashuRecurringCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "KashuRecurringCandidate_userId_status_idx" ON "KashuRecurringCandidate"("userId", "status")`,
  ];

  for (const sql of statements) {
    try {
      await executeDdl(sql);
    } catch (error) {
      console.warn("[ensureKashuSchema]", sql.slice(0, 72), error);
    }
  }
}

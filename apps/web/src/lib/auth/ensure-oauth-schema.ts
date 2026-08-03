import { prisma } from "@forward/database";

/** Ensure OAuth identity columns exist (production may lag prisma push). */
export async function ensureAuthOAuthSchema() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleSub" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appleSub" TEXT`,
  );
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub")`,
    );
  } catch {
    /* index may already exist with another name */
  }
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_appleSub_key" ON "User"("appleSub")`,
    );
  } catch {
    /* ignore */
  }
}

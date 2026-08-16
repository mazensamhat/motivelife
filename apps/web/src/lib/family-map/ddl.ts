import { PrismaClient } from "@prisma/client";

/**
 * Run DDL against DIRECT_URL when available (session mode / non-transaction
 * pooler). PgBouncer transaction mode on DATABASE_URL:6543 often cannot
 * complete ALTER TABLE, which left predictionWhy missing in production.
 */
export async function executeDdl(sql: string): Promise<void> {
  const direct = process.env.DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();

  if (direct && (direct.startsWith("postgresql://") || direct.startsWith("postgres://"))) {
    const client = new PrismaClient({
      datasources: { db: { url: direct } },
      log: ["error"],
    });
    try {
      await client.$executeRawUnsafe(sql);
      return;
    } finally {
      await client.$disconnect().catch(() => undefined);
    }
  }

  // Fallback: pooled URL (may fail under pgbouncer transaction mode).
  if (!pooled) throw new Error("No DATABASE_URL / DIRECT_URL for DDL");
  const { prisma } = await import("@forward/database");
  await prisma.$executeRawUnsafe(sql);
}

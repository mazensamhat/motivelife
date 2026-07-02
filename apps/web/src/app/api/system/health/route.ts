import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthChecks = {
  authSecret: boolean;
  databaseUrl: boolean;
  database: boolean;
};

/** Lightweight readiness check for Vercel / Supabase / AUTH_SECRET. */
export async function GET() {
  const checks: HealthChecks = {
    authSecret: Boolean(process.env.AUTH_SECRET?.trim()),
    databaseUrl: Boolean(
      process.env.DATABASE_URL?.trim()?.startsWith("postgresql://") ||
        process.env.DATABASE_URL?.trim()?.startsWith("postgres://"),
    ),
    database: false,
  };

  let hint: string | undefined;

  if (checks.databaseUrl) {
    try {
      const { prisma } = await import("@forward/database");
      await prisma.$executeRawUnsafe("SELECT 1");
      checks.database = true;
    } catch (error) {
      console.error("[api/system/health]", error);
      hint = error instanceof Error ? error.message.slice(0, 120) : "database_unreachable";
    }
  } else {
    hint = "missing_database_url";
  }

  if (!checks.authSecret) {
    hint = hint ?? "missing_auth_secret";
  }

  const ok = checks.authSecret && checks.databaseUrl && checks.database;
  return json({ ok, checks, hint }, ok ? 200 : 503);
}

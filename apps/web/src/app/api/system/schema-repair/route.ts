import { json, unauthorized } from "@/lib/api";
import { executeDdl } from "@/lib/family-map/ddl";
import { prisma } from "@forward/database";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * One-shot DDL repair for production when additive FamilyMember columns lag.
 * Auth: Authorization: Bearer $CRON_SECRET (or ASC_HELPER_SECRET / AUTH_SECRET)
 */
export async function POST(request: Request) {
  const candidates = [
    process.env.CRON_SECRET?.trim(),
    process.env.ASC_HELPER_SECRET?.trim(),
    process.env.AUTH_SECRET?.trim(),
  ].filter(Boolean) as string[];
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !candidates.includes(token)) {
    return unauthorized();
  }

  const statements = [
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "predictionWhy" TEXT`,
    `ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "typicalEtaMinutes" INTEGER`,
  ];

  const results: Array<{ sql: string; ok: boolean; error?: string }> = [];
  for (const sql of statements) {
    try {
      await executeDdl(sql);
      results.push({ sql: sql.slice(0, 72), ok: true });
    } catch (e) {
      results.push({
        sql: sql.slice(0, 72),
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 160) : String(e),
      });
    }
  }

  let verified = false;
  try {
    await prisma.$queryRaw`SELECT "predictionWhy", "typicalEtaMinutes" FROM "FamilyMember" LIMIT 1`;
    verified = true;
  } catch (e) {
    results.push({
      sql: "verify",
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 160) : String(e),
    });
  }

  return json({ ok: verified, verified, results }, verified ? 200 : 500);
}

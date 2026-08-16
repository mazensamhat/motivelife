import { json, unauthorized } from "@/lib/api";
import { ensureAdditivePredictionColumns } from "@/lib/family-map/ensure-schema";
import { prisma } from "@forward/database";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * One-shot DDL repair for optional prediction columns.
 * Auth: Authorization: Bearer $CRON_SECRET (or ASC_HELPER_SECRET / AUTH_SECRET)
 *
 * Not called from Family Map hot path — ALTER under load timed out map GET.
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

  try {
    await ensureAdditivePredictionColumns();
    await prisma.$queryRaw`SELECT "predictionWhy", "typicalEtaMinutes" FROM "FamilyMember" LIMIT 1`;
    return json({ ok: true, verified: true });
  } catch (e) {
    return json(
      {
        ok: false,
        verified: false,
        error: e instanceof Error ? e.message.slice(0, 200) : String(e),
      },
      500
    );
  }
}

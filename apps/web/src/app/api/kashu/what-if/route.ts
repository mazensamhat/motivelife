import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import { runKashuWhatIf } from "@/lib/kashu/forecast";
import { toKashuMoneyRows, toKashuProfileRow } from "@/lib/kashu/load";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

const schema = z.object({
  spendToday: z.number().min(0).optional(),
  bonusDelta: z.number().optional(),
  moveBillId: z.string().optional(),
  moveBillToDay: z.number().int().min(1).max(31).optional(),
  lowerIncomeBy: z.number().min(0).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid what-if input.");

    const [profile, items] = await Promise.all([
      getOrCreateFinancialProfile(session.id),
      prisma.moneyItem.findMany({ where: { userId: session.id } }),
    ]);

    const result = runKashuWhatIf(
      toKashuProfileRow(profile),
      toKashuMoneyRows(items),
      parsed.data
    );

    return json(result);
  } catch (error) {
    console.error("[api/kashu/what-if]", error);
    return serverError("What-if simulation failed.");
  }
}

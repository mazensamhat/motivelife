import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import { advancePaydayDate } from "@/lib/kashu/forecast";
import { loadKashuForecast, toKashuProfileFields } from "@/lib/kashu/load";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

const paydaySchema = z.object({
  /** New operating balance after payday (preferred). */
  newBalance: z.number().min(0).optional(),
  /** Deposit amount — added to current balance if newBalance omitted. */
  depositAmount: z.number().min(0).optional(),
  /** Advance nextPayday by pay frequency (default true). */
  advanceNextPayday: z.boolean().optional().default(true),
  /** Explicit next payday ISO date (overrides auto-advance). */
  nextPayday: z.string().datetime().optional().nullable(),
});

/**
 * Payday Mode — confirm a deposit / balance update and recalculate Safe to Spend.
 * Framing: not "I got $X" but "only $Y isn't already spoken for."
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = await request.json();
    const parsed = paydaySchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid payday confirmation.");

    const existing = await getOrCreateFinancialProfile(session.id);
    const { newBalance, depositAmount, advanceNextPayday, nextPayday } = parsed.data;

    if (newBalance == null && depositAmount == null) {
      return badRequest("Provide newBalance or depositAmount.");
    }

    const priorBalance = existing.liquidBalance ?? 0;
    const liquidBalance =
      newBalance != null
        ? newBalance
        : Math.max(0, priorBalance + (depositAmount ?? 0));
    const deposit =
      depositAmount != null
        ? depositAmount
        : Math.max(0, liquidBalance - priorBalance);

    let nextPaydayDate: Date | null = existing.nextPayday;
    if (nextPayday !== undefined) {
      nextPaydayDate = nextPayday ? new Date(nextPayday) : null;
    } else if (advanceNextPayday) {
      nextPaydayDate = advancePaydayDate(
        existing.nextPayday,
        existing.payFrequency,
        existing.paydayAnchorDay,
        new Date()
      );
    }

    const profile = await prisma.financialProfile.update({
      where: { userId: session.id },
      data: {
        liquidBalance,
        nextPayday: nextPaydayDate,
      },
    });

    const data = await loadKashuForecast(session.id);
    const spokenFor = data.forecast.reservedObligations + data.forecast.safetyFloor;
    const free = data.forecast.safeToSpend;
    const headline =
      deposit > 0
        ? `Payday confirmed — ${formatMoney(deposit)} landed. ${formatMoney(free)} isn't already spoken for.`
        : `Balance updated. ${formatMoney(free)} isn't already spoken for.`;

    return json({
      ...data,
      profile: toKashuProfileFields(profile),
      payday: {
        deposit,
        priorBalance,
        newBalance: liquidBalance,
        spokenFor,
        freeToUse: free,
        headline,
        nextPayday: nextPaydayDate?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[api/kashu/payday]", error);
    return serverError("Could not confirm payday.");
  }
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

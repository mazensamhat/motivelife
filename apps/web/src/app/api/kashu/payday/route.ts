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
  /** Calendar day the deposit landed (YYYY-MM-DD). Defaults to today / recent nextPayday. */
  depositDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
    const { newBalance, depositAmount, advanceNextPayday, nextPayday, depositDate } =
      parsed.data;

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

    const today = new Date();
    const todayYmd = localYmd(today);
    // If they confirm a day or two after payday, stamp the deposit on the modeled payday.
    let depositYmd = depositDate ?? todayYmd;
    if (!depositDate && existing.nextPayday) {
      const modeled = localYmd(existing.nextPayday);
      const modeledMs = new Date(`${modeled}T12:00:00`).getTime();
      const todayMs = new Date(`${todayYmd}T12:00:00`).getTime();
      const lagDays = Math.round((todayMs - modeledMs) / 86400000);
      if (lagDays >= 0 && lagDays <= 2) depositYmd = modeled;
    }

    let nextPaydayDate: Date | null = existing.nextPayday;
    if (nextPayday !== undefined) {
      nextPaydayDate = nextPayday ? new Date(nextPayday) : null;
    } else if (advanceNextPayday) {
      // Step from the deposit day so Saturday pay stays on Saturday.
      const fromDeposit = new Date(`${depositYmd}T12:00:00`);
      nextPaydayDate = advancePaydayDate(
        fromDeposit,
        existing.payFrequency,
        existing.paydayAnchorDay,
        fromDeposit
      );
    }

    const profile = await prisma.financialProfile.update({
      where: { userId: session.id },
      data: {
        liquidBalance,
        nextPayday: nextPaydayDate,
        ...(deposit >= 500
          ? { typicalPaycheck: Math.round(deposit * 100) / 100 }
          : {}),
      },
    });

    // Persist the deposit as a payroll credit so the calendar shows the real
    // amount on that day (not a stale low-band cadence guess like +3.7k).
    if (deposit >= 500) {
      const dayStart = new Date(`${depositYmd}T00:00:00.000Z`);
      const dayEnd = new Date(`${depositYmd}T23:59:59.999Z`);
      const existingCredit = await prisma.kashuTransaction
        .findFirst({
          where: {
            userId: session.id,
            direction: "credit",
            postedAt: { gte: dayStart, lte: dayEnd },
            amount: { gte: deposit * 0.98, lte: deposit * 1.02 },
          },
          select: { id: true },
        })
        .catch(() => null);

      if (!existingCredit) {
        await prisma.kashuTransaction
          .create({
            data: {
              userId: session.id,
              postedAt: new Date(`${depositYmd}T12:00:00.000Z`),
              description: "PAYROLL DIRECT DEPOSIT (confirmed)",
              amount: deposit,
              direction: "credit",
              classification: "income",
              isTransfer: false,
              isOneOff: false,
              balanceAfter: liquidBalance,
            },
          })
          .catch((err) => {
            console.warn("[api/kashu/payday] could not store deposit tx", err);
          });
      }
    }

    const data = await loadKashuForecast(session.id);
    const spokenFor =
      data.forecast.reservedObligations + data.forecast.safetyFloor;
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
        depositDate: depositYmd,
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

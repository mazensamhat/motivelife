import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

/**
 * Wipe all Kashu cash-flow data for the signed-in user so they can re-upload
 * statements from a clean slate.
 *
 * Body: { confirm: "RESET_KASHU" }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
    if (body?.confirm !== "RESET_KASHU") {
      return badRequest('Send { "confirm": "RESET_KASHU" } to wipe Kashu data.');
    }

    await ensureKashuSchema();
    const userId = session.id;

    const [transactions, candidates, statements, moneyItems] = await prisma.$transaction([
      prisma.kashuTransaction.deleteMany({ where: { userId } }),
      prisma.kashuRecurringCandidate.deleteMany({ where: { userId } }),
      prisma.kashuStatement.deleteMany({ where: { userId } }),
      // Obligation rows Kashu pins / learns — keep savings/debt/investments.
      prisma.moneyItem.deleteMany({
        where: {
          userId,
          OR: [
            { source: { in: ["statement", "voice", "detected"] } },
            {
              type: {
                in: ["BILL", "HOUSING", "SUBSCRIPTION", "LIVING_EXPENSE", "COMMITMENT"],
              },
            },
          ],
        },
      }),
    ]);

    await getOrCreateFinancialProfile(userId);
    await prisma.financialProfile.update({
      where: { userId },
      data: {
        liquidBalance: null,
        safetyFloor: 0,
        emergencyReserve: 0,
        lifestyleBurnDaily: 0,
        payFrequency: null,
        nextPayday: null,
        paydayAnchorDay: null,
        monthlyTakeHome: null,
        typicalPaycheck: null,
        incomeKind: "FIXED",
        incomeConservative: null,
        incomeHigh: null,
        kashuLearningJson: null,
        transitionJson: null,
      },
    });

    return json({
      ok: true,
      deleted: {
        transactions: transactions.count,
        recurringCandidates: candidates.count,
        statements: statements.count,
        moneyItems: moneyItems.count,
      },
    });
  } catch (error) {
    console.error("[api/kashu/reset]", error);
    return serverError("Could not reset Kashu data.");
  }
}

import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { json, unauthorized, serverError, badRequest } from "@/lib/api";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import { loadKashuForecast } from "@/lib/kashu/load";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

/**
 * Wipe Kashu money model so the user can re-upload statements from a clean slate.
 * POST body: { confirm: "WIPE" }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
    if (body?.confirm !== "WIPE") {
      return badRequest('Confirm wipe with { "confirm": "WIPE" }.');
    }

    const userId = session.id;
    await getOrCreateFinancialProfile(userId);

    const [txCount, candidateCount, statementCount, moneyCount] = await prisma.$transaction(
      async (tx) => {
        const transactions = await tx.kashuTransaction.deleteMany({ where: { userId } });
        const candidates = await tx.kashuRecurringCandidate.deleteMany({ where: { userId } });
        const statements = await tx.kashuStatement.deleteMany({ where: { userId } });
        const moneyItems = await tx.moneyItem.deleteMany({ where: { userId } });

        await tx.financialProfile.update({
          where: { userId },
          data: {
            liquidBalance: null,
            safetyFloor: 0,
            emergencyReserve: 0,
            payFrequency: null,
            nextPayday: null,
            paydayAnchorDay: null,
            lifestyleBurnDaily: 0,
            monthlyTakeHome: null,
            incomeKind: "FIXED",
            incomeConservative: null,
            incomeHigh: null,
            transitionJson: null,
            kashuLearningJson: null,
          },
        });

        return [
          transactions.count,
          candidates.count,
          statements.count,
          moneyItems.count,
        ] as const;
      }
    );

    const data = await loadKashuForecast(userId);
    return json({
      wiped: true,
      deleted: {
        transactions: txCount,
        recurringCandidates: candidateCount,
        statements: statementCount,
        moneyItems: moneyCount,
      },
      ...data,
    });
  } catch (error) {
    console.error("[api/kashu/reset]", error);
    return serverError("Could not wipe Kashu data.");
  }
}

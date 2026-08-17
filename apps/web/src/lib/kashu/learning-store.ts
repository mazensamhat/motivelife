import { prisma } from "@forward/database";
import {
  applyObservation,
  parseLearningJson,
  type KashuLearningState,
} from "@/lib/kashu/learning";
import type { KashuBalanceSnapshot } from "@forward/shared";

export async function loadLearningState(userId: string): Promise<KashuLearningState> {
  const rows = await prisma.$queryRaw<Array<{ kashuLearningJson: string | null }>>`
    SELECT "kashuLearningJson" FROM "FinancialProfile" WHERE "userId" = ${userId} LIMIT 1
  `.catch(() => [] as Array<{ kashuLearningJson: string | null }>);
  return parseLearningJson(rows[0]?.kashuLearningJson);
}

export async function saveLearningState(userId: string, state: KashuLearningState): Promise<void> {
  const json = JSON.stringify(state);
  await prisma.$executeRaw`
    UPDATE "FinancialProfile" SET "kashuLearningJson" = ${json} WHERE "userId" = ${userId}
  `.catch((error) => {
    console.warn("[kashu learning] save failed", error);
  });
}

export async function recordKashuObservation(
  userId: string,
  actualBalance: number,
  source: KashuBalanceSnapshot["source"]
): Promise<KashuLearningState> {
  const state = applyObservation(await loadLearningState(userId), actualBalance, source);
  await saveLearningState(userId, state);
  return state;
}

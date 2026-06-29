import { prisma } from "@forward/database";
import type { PartnerActivityPayload } from "@forward/shared";
import { getLifeEngineStreak } from "./life-engine-streak";

export async function getPartnerActivity(linkedUserId: string): Promise<PartnerActivityPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: linkedUserId },
    select: { name: true },
  });
  if (!user) return null;

  const streak = await getLifeEngineStreak(linkedUserId);
  return {
    name: user.name?.split(" ")[0] ?? "Partner",
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    completedToday: streak.completedToday,
    atRisk: streak.atRisk,
  };
}

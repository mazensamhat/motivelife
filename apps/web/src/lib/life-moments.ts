import { prisma, type LifeMomentCategory } from "@forward/database";
import type { LifeDomain } from "@forward/shared";

const CATEGORY_MAP: Record<string, LifeMomentCategory> = {
  CAREER: "CAREER",
  MONEY: "MONEY",
  HEALTH: "HEALTH",
  LEARNING: "LEARNING",
  RELATIONSHIPS: "RELATIONSHIPS",
  HABITS: "PERSONAL",
  PROJECTS: "LIFE_EVENT",
  TRAVEL: "LIFE_EVENT",
  BUSINESS: "CAREER",
  DREAMS: "PERSONAL",
};

export async function recordLifeMoment(
  userId: string,
  input: {
    title: string;
    description?: string;
    domain?: LifeDomain | null;
    category?: LifeMomentCategory;
    scoreDelta?: number;
    sourceType?: string;
    sourceId?: string;
    occurredAt?: Date;
  }
) {
  const category =
    input.category ??
    (input.domain ? CATEGORY_MAP[input.domain] ?? "LIFE_EVENT" : "LIFE_EVENT");

  return prisma.lifeMoment.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      category,
      domain: input.domain ?? undefined,
      scoreDelta: input.scoreDelta,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      occurredAt: input.occurredAt ?? new Date(),
      permanent: true,
    },
  });
}

export async function getLifeMoments(userId: string, limit = 30) {
  return prisma.lifeMoment.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

export function formatLifeMoment(m: Awaited<ReturnType<typeof getLifeMoments>>[0]) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    domain: m.domain,
    occurredAt: m.occurredAt.toISOString(),
    scoreDelta: m.scoreDelta,
    permanent: m.permanent,
  };
}

/** Promote significant progress moments into permanent Life Moments */
export async function syncProgressToLifeMoments(userId: string) {
  const recent = await prisma.progressMoment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  for (const p of recent) {
    const exists = await prisma.lifeMoment.findFirst({
      where: { userId, sourceType: "PROGRESS_MOMENT", sourceId: p.id },
    });
    if (exists) continue;

    const isMajor =
      p.type === "GOAL_COMPLETED" ||
      p.type === "MILESTONE" ||
      /promotion|house|degree|debt|company|child|wedding|retire|offer/i.test(p.title);

    if (isMajor || p.type === "GOAL_COMPLETED") {
      await recordLifeMoment(userId, {
        title: p.title,
        domain: p.domain,
        scoreDelta: p.type === "GOAL_COMPLETED" ? 8 : 4,
        sourceType: "PROGRESS_MOMENT",
        sourceId: p.id,
        occurredAt: p.createdAt,
      });
    }
  }
}

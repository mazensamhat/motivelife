import { z } from "zod";
import { prisma } from "@forward/database";
import { LIFE_DOMAINS } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, startOfDay } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";
import { autoLinkGoalToDestination } from "@/lib/life-graph";
import { recordLifeMoment } from "@/lib/life-moments";
import { ensureGoalCoachingLoopForGoal, completeGoalCoachingLoops } from "@/lib/adaptive-coaching";
import { awardLifeXp } from "@/lib/life-xp";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  domain: z.enum(LIFE_DOMAINS),
  targetDate: z.string().datetime().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  progress: z.number().min(0).max(100).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const goals = await prisma.goal.findMany({
    where: { userId: session.id, status: { not: "ARCHIVED" } },
    include: { _count: { select: { tasks: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return json({ goals });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { title, description, domain, targetDate } = parsed.data;

  const goal = await prisma.goal.create({
    data: {
      userId: session.id,
      title,
      description,
      domain,
      targetDate: targetDate ? new Date(targetDate) : undefined,
    },
  });

  await autoLinkGoalToDestination(session.id, goal.id, goal.title);
  await ensureGoalCoachingLoopForGoal(session.id, goal);

  return json({ goal }, 201);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { id, status, progress } = parsed.data;

  const existing = await prisma.goal.findFirst({ where: { id, userId: session.id } });
  if (!existing) return badRequest("Goal not found");

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(progress !== undefined && { progress: status === "COMPLETED" ? 100 : progress }),
    },
  });

  if (status === "COMPLETED" && existing.status !== "COMPLETED") {
    await recordProgressMoment(session.id, goal.title, "GOAL_COMPLETED", goal.domain);
    await recordLifeMoment(session.id, {
      title: goal.title,
      domain: goal.domain,
      scoreDelta: 8,
      sourceType: "GOAL",
      sourceId: goal.id,
    });
    await completeGoalCoachingLoops(session.id, goal.id);
    await awardLifeXp(session.id, [
      { dimension: "confidence", amount: 25, reason: `Goal completed: ${goal.title}`, sourceType: "GOAL", sourceId: goal.id },
      {
        dimension:
          goal.domain === "MONEY"
            ? "money"
            : goal.domain === "HEALTH"
              ? "health"
              : goal.domain === "LEARNING"
                ? "learning"
                : goal.domain === "CAREER" || goal.domain === "BUSINESS"
                  ? "career"
                  : "confidence",
        amount: 30,
        reason: `Major milestone — ${goal.title}`,
        sourceType: "GOAL",
        sourceId: goal.id,
      },
    ]);

    const today = startOfDay();
    await prisma.eveningReview.deleteMany({
      where: { userId: session.id, date: { gte: today } },
    });
  }

  return json({ goal });
}

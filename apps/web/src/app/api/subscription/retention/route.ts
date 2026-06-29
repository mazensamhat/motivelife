import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { computeLifeScore } from "@/lib/generation";
import { getProgressStats } from "@/lib/forward";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [user, stats, momentsCount, goalsActive, tasksThisWeek] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        name: true,
        lifeEngineStreak: true,
        lifeEngineBestStreak: true,
      },
    }),
    getProgressStats(session.id),
    prisma.lifeMoment.count({ where: { userId: session.id } }),
    prisma.goal.count({ where: { userId: session.id, status: "ACTIVE" } }),
    prisma.task.count({
      where: {
        userId: session.id,
        status: "DONE",
        completedAt: { gte: weekAgo },
      },
    }),
  ]);

  return json({
    lifeScore: computeLifeScore(stats),
    streak: user?.lifeEngineStreak ?? 0,
    bestStreak: user?.lifeEngineBestStreak ?? 0,
    momentsCount,
    goalsActive,
    tasksCompletedThisWeek: tasksThisWeek,
    userName: user?.name ?? session.name,
  });
}

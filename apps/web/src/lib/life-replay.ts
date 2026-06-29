import { prisma } from "@forward/database";
import type { LifeReplayPayload } from "@forward/shared";
import { parseUserPersona, hasBelief } from "./user-persona";

const DOMAIN_EMOJI: Record<string, string> = {
  CAREER: "💼",
  MONEY: "💰",
  HEALTH: "❤️",
  LEARNING: "📚",
  RELATIONSHIPS: "👨‍👩‍👧",
  HABITS: "⏰",
  default: "✨",
};

export async function buildLifeReplay(userId: string): Promise<LifeReplayPayload | null> {
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const isYearEnd = now.getMonth() === 11 && now.getDate() >= 28;

  const [moments, goalsCompleted, tasksCompleted, snapshots, insights, userRow] = await Promise.all([
    prisma.lifeMoment.findMany({
      where: { userId, occurredAt: { gte: yearStart, lt: yearEnd } },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    prisma.goal.count({
      where: {
        userId,
        status: "COMPLETED",
        updatedAt: { gte: yearStart, lt: yearEnd },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: yearStart, lt: yearEnd },
      },
    }),
    prisma.dailyScoreSnapshot.findMany({
      where: { userId, date: { gte: yearStart, lt: yearEnd } },
      orderBy: { date: "asc" },
      take: 400,
    }),
    prisma.lifeInsight.findMany({
      where: { userId, date: { gte: yearStart, lt: yearEnd } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { beliefs: true } }),
  ]);

  if (moments.length === 0 && tasksCompleted === 0 && goalsCompleted === 0) {
    return null;
  }

  const parseOverall = (raw: string) => {
    try {
      const s = JSON.parse(raw) as { overall?: number };
      return s.overall ?? 0;
    } catch {
      return 0;
    }
  };

  const parseDomainScores = (raw: string) => {
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  };

  const scoreStart = snapshots[0] ? parseOverall(snapshots[0].scores) : 0;
  const scoreNow = snapshots[snapshots.length - 1]
    ? parseOverall(snapshots[snapshots.length - 1].scores)
    : scoreStart;

  const domainTotals: Record<string, number> = {};
  for (const s of snapshots.slice(-30)) {
    const d = parseDomainScores(s.scores);
    for (const [key, val] of Object.entries(d)) {
      if (key === "overall" || key === "overallDelta" || key === "domainDeltas") continue;
      domainTotals[key] = (domainTotals[key] ?? 0) + (typeof val === "number" ? val : 0);
    }
  }

  const topDomain =
    Object.entries(domainTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "career";

  const highlights = moments.slice(0, 6).map((m) => ({
    id: m.id,
    title: m.title,
    occurredAt: m.occurredAt.toISOString(),
    emoji: DOMAIN_EMOJI[m.domain ?? ""] ?? DOMAIN_EMOJI.default,
  }));

  const persona = parseUserPersona(userRow ?? {});

  const beliefLessons: string[] = [];
  if (hasBelief(persona, "family_first") && moments.some((m) => m.domain === "RELATIONSHIPS")) {
    beliefLessons.push("Family first showed up in your year — relationships were a through-line.");
  }
  if (hasBelief(persona, "financial_freedom") && moments.some((m) => m.domain === "MONEY")) {
    beliefLessons.push("Financial freedom wasn't just a belief — you logged real money milestones.");
  }
  if (hasBelief(persona, "health_matters") && moments.some((m) => m.domain === "HEALTH")) {
    beliefLessons.push("Health mattered to you — your body of work includes taking care of yourself.");
  }
  if (hasBelief(persona, "build_business") && moments.some((m) => m.domain === "CAREER")) {
    beliefLessons.push("Building something of your own stayed on your radar all year.");
  }

  const rawLessons =
    insights.length > 0
      ? insights.map((i) => i.insight)
      : [
          ...beliefLessons,
          goalsCompleted > 0
            ? `You completed ${goalsCompleted} goal${goalsCompleted === 1 ? "" : "s"} this year.`
            : "Small daily wins compound — keep showing up.",
          tasksCompleted > 0
            ? `${tasksCompleted} tasks finished — consistency beats intensity.`
            : "Your Life Graph is ready for your first milestone.",
        ];

  const lessons = [...new Set(rawLessons)].slice(0, 4);

  const headline = isYearEnd ? `My ${year}` : `Your ${year} so far`;
  const subheadline = isYearEnd
    ? "The year in your life — wins, growth, and what you learned."
    : "A preview of your Life Replay — more chapters still to write.";

  return {
    year,
    headline,
    subheadline,
    isYearEnd,
    stats: {
      lifeMoments: moments.length,
      goalsCompleted,
      tasksCompleted,
      scoreStart,
      scoreNow,
      scoreDelta: scoreNow - scoreStart,
      topDomain,
    },
    highlights,
    lessons: lessons,
  };
}

export function shouldShowLifeReplay(): boolean {
  return new Date().getMonth() >= 10;
}

const DOMAIN_LABEL: Record<string, string> = {
  career: "Career",
  money: "Money",
  health: "Health",
  learning: "Learning",
  relationships: "Relationships",
  mindset: "Mindset",
};

/** Shareable text card — Spotify Wrapped style, no image gen needed */
export function formatLifeReplayShareText(
  replay: LifeReplayPayload,
  userName?: string | null
): string {
  const who = userName?.split(" ")[0] ?? "My";
  const lines = [
    `${who}'s ${replay.year} Life Replay — motivelife.ai`,
    "",
    `${replay.stats.lifeMoments} life moments · ${replay.stats.goalsCompleted} goals done · ${replay.stats.tasksCompleted} tasks finished`,
    `Motive Life Score: ${replay.stats.scoreStart} → ${replay.stats.scoreNow} (${replay.stats.scoreDelta >= 0 ? "+" : ""}${replay.stats.scoreDelta})`,
    `Strongest area: ${DOMAIN_LABEL[replay.stats.topDomain] ?? replay.stats.topDomain}`,
  ];

  if (replay.highlights.length > 0) {
    lines.push("", "Biggest wins:");
    for (const h of replay.highlights.slice(0, 4)) {
      lines.push(`${h.emoji} ${h.title}`);
    }
  }

  if (replay.lessons[0]) {
    lines.push("", replay.lessons[0]);
  }

  lines.push("", "Build your life story → motivelife.ai");
  return lines.join("\n");
}

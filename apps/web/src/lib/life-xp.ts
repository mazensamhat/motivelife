import { prisma } from "@forward/database";
import {
  LIFE_XP_DIMENSIONS,
  type LifeXpAward,
  type LifeXpDimensionId,
  type LifeXpGain,
  type LifeXpGrowthPayload,
  type LifeXpPayload,
} from "@forward/shared";

const TIER_THRESHOLDS = [
  { min: 0, label: "Emerging" },
  { min: 50, label: "Building" },
  { min: 150, label: "Developing" },
  { min: 350, label: "Capable" },
  { min: 700, label: "Strong" },
  { min: 1200, label: "Expert" },
];

function capabilityForXp(total: number): { label: string; progressToNext: number; xpToNext: number } {
  let tier = TIER_THRESHOLDS[0];
  let next = TIER_THRESHOLDS[1];
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (total >= TIER_THRESHOLDS[i].min) {
      tier = TIER_THRESHOLDS[i];
      next = TIER_THRESHOLDS[i + 1] ?? { min: tier.min + 500, label: "Expert" };
    }
  }
  const range = next.min - tier.min;
  const progress = range > 0 ? Math.min(100, Math.round(((total - tier.min) / range) * 100)) : 100;
  return { label: tier.label, progressToNext: progress, xpToNext: Math.max(0, next.min - total) };
}

export function xpAwardsForAction(input: {
  domain: string | null;
  title: string;
  lifeEngine?: boolean;
}): LifeXpAward[] {
  const awards: LifeXpAward[] = [];
  const blob = input.title.toLowerCase();
  const domain = input.domain?.toUpperCase() ?? "";

  const push = (dimension: LifeXpDimensionId, amount: number, reason: string) => {
    awards.push({ dimension, amount, reason });
  };

  if (input.lifeEngine) {
    push("career", 8, "Life Engine daily commitment");
    push("confidence", 6, "Showing up consistently");
  }

  if (domain === "CAREER" || /apply|interview|resume|job|career/i.test(blob)) {
    push("career", 12, "Career progress");
    if (/interview|present|speak|pitch|communicat|intro/i.test(blob)) {
      push("communication", 10, "Communication practice");
      push("confidence", 8, "Confidence under pressure");
    }
    if (/lead|manage|team|delegate/i.test(blob)) push("leadership", 10, "Leadership action");
    if (/business|launch|client|revenue|startup/i.test(blob)) push("business", 10, "Business building");
  }

  if (domain === "MONEY" || /save|pay|debt|budget|bill|invest/i.test(blob)) {
    push("money", 12, "Financial discipline");
  }

  if (domain === "HEALTH" || /workout|walk|run|gym|sleep|health|protein/i.test(blob)) {
    push("health", 12, "Health investment");
    push("confidence", 4, "Body-mind alignment");
  }

  if (domain === "LEARNING" || /learn|course|read|skill|study|practice/i.test(blob)) {
    push("learning", 12, "Skill development");
  }

  if (domain === "RELATIONSHIPS" || /call|family|friend|message|visit/i.test(blob)) {
    push("communication", 8, "Relationship communication");
    push("leadership", 4, "Showing up for others");
  }

  if (domain === "BUSINESS" || domain === "PROJECTS") {
    push("business", 12, "Business progress");
    push("leadership", 6, "Ownership mindset");
  }

  if (awards.length === 0) {
    push("confidence", 6, "Daily follow-through");
  }

  return awards;
}

export async function awardLifeXp(userId: string, awards: LifeXpAward[]): Promise<LifeXpGain[]> {
  if (awards.length === 0) return [];

  const created = await Promise.all(
    awards.map((a) =>
      prisma.lifeXpEntry.create({
        data: {
          userId,
          dimension: a.dimension,
          amount: a.amount,
          reason: a.reason,
          sourceType: a.sourceType ?? null,
          sourceId: a.sourceId ?? null,
        },
      })
    )
  );

  return created.map((e) => ({
    dimension: e.dimension as LifeXpDimensionId,
    amount: e.amount,
    reason: e.reason,
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function getLifeXpPayload(userId: string): Promise<LifeXpPayload> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [totals, recent] = await Promise.all([
    prisma.lifeXpEntry.groupBy({
      by: ["dimension"],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.lifeXpEntry.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const totalMap = new Map(totals.map((t) => [t.dimension, t._sum.amount ?? 0]));
  const weekGainMap = new Map<string, number>();
  for (const r of recent) {
    weekGainMap.set(r.dimension, (weekGainMap.get(r.dimension) ?? 0) + r.amount);
  }

  const dimensions = LIFE_XP_DIMENSIONS.map((d) => {
    const totalXp = totalMap.get(d.id) ?? 0;
    const cap = capabilityForXp(totalXp);
    return {
      id: d.id,
      label: d.label,
      color: d.color,
      totalXp,
      capability: cap.label,
      progressToNext: cap.progressToNext,
      xpToNext: cap.xpToNext,
      recentGain: weekGainMap.get(d.id) ?? 0,
    };
  }).sort((a, b) => b.totalXp - a.totalXp);

  const top = dimensions.filter((d) => d.totalXp > 0).slice(0, 3);
  const rising = dimensions.filter((d) => d.recentGain > 0).sort((a, b) => b.recentGain - a.recentGain)[0];

  const headline =
    top.length >= 2
      ? `You're becoming more capable in ${top.map((d) => d.label.toLowerCase()).join(", ")}`
      : "Every action builds real capability";

  const subheadline = rising
    ? `+${rising.recentGain} ${rising.label} XP this week — ${rising.capability} tier`
    : "Complete actions to grow across the areas you care about";

  return {
    dimensions,
    recentGains: recent.map((r) => ({
      dimension: r.dimension as LifeXpDimensionId,
      amount: r.amount,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
    headline,
    subheadline,
  };
}

export async function getLifeXpGrowthPayload(userId: string): Promise<LifeXpGrowthPayload> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [yearEntries, monthEntries, prevMonthEntries, milestones] = await Promise.all([
    prisma.lifeXpEntry.findMany({ where: { userId, createdAt: { gte: yearStart } } }),
    prisma.lifeXpEntry.findMany({ where: { userId, createdAt: { gte: monthStart } } }),
    prisma.lifeXpEntry.findMany({
      where: { userId, createdAt: { gte: prevMonthStart, lt: monthStart } },
    }),
    prisma.lifeXpEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const sumByDim = (entries: typeof yearEntries) => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.dimension, (m.get(e.dimension) ?? 0) + e.amount);
    return m;
  };

  const yearMap = sumByDim(yearEntries);
  const monthMap = sumByDim(monthEntries);
  const prevMonthMap = sumByDim(prevMonthEntries);

  const dimensions = LIFE_XP_DIMENSIONS.map((d) => {
    const yearXp = yearMap.get(d.id) ?? 0;
    const monthXp = monthMap.get(d.id) ?? 0;
    const prev = prevMonthMap.get(d.id) ?? 0;
    return {
      id: d.id,
      label: d.label,
      color: d.color,
      yearXp,
      monthXp,
      capability: capabilityForXp(yearXp).label,
      deltaMonth: monthXp - prev,
    };
  })
    .filter((d) => d.yearXp > 0)
    .sort((a, b) => b.yearXp - a.yearXp);

  const yearTotal = yearEntries.reduce((s, e) => s + e.amount, 0);
  const monthTotal = monthEntries.reduce((s, e) => s + e.amount, 0);
  const top = dimensions[0];

  return {
    yearTotal,
    monthTotal,
    dimensions,
    recentMilestones: milestones.map((m) => ({
      dimension: m.dimension as LifeXpDimensionId,
      amount: m.amount,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    })),
    headline: top
      ? `${top.label} grew most this year — ${top.capability} capability`
      : "Your capability story starts with the next action",
  };
}

import { prisma } from "@forward/database";
import { getSocialPlatforms, SOCIAL_PLATFORM_IDS, type SocialPlatformId } from "@/lib/marketing-channels";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabels(days: number) {
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    labels.push(daysAgo(i).toISOString().slice(0, 10));
  }
  return labels;
}

export async function getTrafficAnalytics(days = 30) {
  const start = daysAgo(days);
  const labels = dayLabels(Math.min(days, 14));

  const [views, signupsByChannel] = await Promise.all([
    prisma.pageView.findMany({
      where: { createdAt: { gte: start } },
      select: { path: true, source: true, createdAt: true },
    }),
    prisma.user.groupBy({
      by: ["acquisitionChannel"],
      where: { createdAt: { gte: start } },
      _count: { _all: true },
    }),
  ]);

  const signupMap = new Map<string, number>();
  for (const row of signupsByChannel) {
    signupMap.set(row.acquisitionChannel ?? "direct", row._count._all);
  }

  const viewsByDay: Record<string, number> = Object.fromEntries(labels.map((d) => [d, 0]));
  const viewsBySource = new Map<string, number>();
  const viewsByPath = new Map<string, number>();

  for (const v of views) {
    const day = v.createdAt.toISOString().slice(0, 10);
    if (viewsByDay[day] != null) viewsByDay[day] += 1;
    viewsBySource.set(v.source, (viewsBySource.get(v.source) ?? 0) + 1);
    viewsByPath.set(v.path, (viewsByPath.get(v.path) ?? 0) + 1);
  }

  const oneDayAgo = daysAgo(1);
  const sevenDaysAgo = daysAgo(7);

  const views24h = views.filter((v) => v.createdAt >= oneDayAgo).length;
  const views7d = views.filter((v) => v.createdAt >= sevenDaysAgo).length;

  const topPages = [...viewsByPath.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  const topSources = [...viewsBySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([source, count]) => ({ source, count }));

  const socialPlatforms = getSocialPlatforms().map((platform) => {
    const pageViews = viewsBySource.get(platform.utmSource) ?? 0;
    const signups = signupMap.get(platform.utmSource) ?? 0;
    return {
      ...platform,
      pageViews,
      signups,
      conversionRate: pageViews > 0 ? Math.round((signups / pageViews) * 1000) / 10 : 0,
    };
  });

  const socialViews = SOCIAL_PLATFORM_IDS.reduce(
    (sum, id) => sum + (viewsBySource.get(id) ?? 0),
    0
  );

  return {
    summary: {
      views24h,
      views7d,
      views30d: views.length,
      uniqueSources: viewsBySource.size,
      socialViews,
    },
    viewsByDay: labels.map((day) => ({ day, count: viewsByDay[day] ?? 0 })),
    topPages,
    topSources,
    socialPlatforms,
    vercelAnalyticsUrl: "https://vercel.com/mazensamhat/motivelife-web/analytics",
  };
}

export type TrafficAnalytics = Awaited<ReturnType<typeof getTrafficAnalytics>>;

export function isSocialPlatformId(value: string): value is SocialPlatformId {
  return (SOCIAL_PLATFORM_IDS as string[]).includes(value);
}

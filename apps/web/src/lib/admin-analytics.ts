import { prisma } from "@forward/database";
import { PLAN_PRICE_LABEL } from "@/lib/subscription";
import { COUNTRY_CENTROIDS, countryDisplayName, countryToContinent } from "@/lib/geo/continents";

const PRO_PRICE_CAD = 14.99;

export const OPS_MODULES = [
  "dashboard",
  "goals",
  "career",
  "money",
  "health",
  "habits",
  "learning",
  "relationships",
  "voice",
  "settings",
] as const;

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Today / Dashboard",
  goals: "Goals",
  career: "Career",
  money: "Money",
  health: "Health",
  habits: "Habits",
  learning: "Learning",
  relationships: "Relationships",
  voice: "Voice / AI",
  settings: "Settings",
};

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabels(days: number) {
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

function generationBucket(birthYear: number | null | undefined): string {
  if (!birthYear) return "Unknown";
  const age = new Date().getFullYear() - birthYear;
  if (age <= 24) return "Gen Z";
  if (age <= 34) return "Millennial";
  if (age <= 44) return "Gen X";
  return "Boomers+";
}

function ageBucket(birthYear: number | null | undefined): string | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age < 30) return "18-29";
  if (age < 46) return "30-45";
  if (age < 62) return "46-61";
  return "62+";
}

function resolveMapCoords(user: {
  signupLatitude: number | null;
  signupLongitude: number | null;
  signupCountry: string | null;
}) {
  if (user.signupLatitude != null && user.signupLongitude != null) {
    return { lat: user.signupLatitude, lng: user.signupLongitude };
  }
  if (user.signupCountry) {
    const c = COUNTRY_CENTROIDS[user.signupCountry.toUpperCase()];
    if (c) return { lat: c.lat, lng: c.lng };
  }
  return null;
}

function countBy<T>(items: T[], keyFn: (item: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

async function getActivityHeatmap(days = 14) {
  const start = daysAgo(days);
  const labels = dayLabels(days);
  const events = await prisma.usageEvent.findMany({
    where: { createdAt: { gte: start } },
    select: { module: true, createdAt: true },
  });

  const grid: Record<string, Record<string, number>> = {};
  for (const mod of OPS_MODULES) {
    grid[mod] = Object.fromEntries(labels.map((d) => [d, 0]));
  }

  let max = 0;
  for (const e of events) {
    const day = e.createdAt.toISOString().slice(0, 10);
    const mod = e.module in grid ? e.module : "dashboard";
    if (grid[mod]?.[day] != null) {
      grid[mod][day] += 1;
      max = Math.max(max, grid[mod][day]);
    }
  }

  return { days: labels, modules: [...OPS_MODULES], cells: grid, max };
}

async function getModuleActivityRanking(days = 30) {
  const start = daysAgo(days);
  const rows = await prisma.usageEvent.groupBy({
    by: ["module"],
    where: { createdAt: { gte: start } },
    _count: { _all: true },
  });
  const users = await prisma.usageEvent.groupBy({
    by: ["module", "userId"],
    where: { createdAt: { gte: start } },
  });
  const uniqueByModule = new Map<string, Set<string>>();
  for (const r of users) {
    if (!uniqueByModule.has(r.module)) uniqueByModule.set(r.module, new Set());
    uniqueByModule.get(r.module)!.add(r.userId);
  }

  return rows
    .map((r) => ({
      module: r.module,
      events: r._count._all,
      unique_users: uniqueByModule.get(r.module)?.size ?? 0,
    }))
    .sort((a, b) => b.events - a.events);
}

async function getSubscriptionsByModule() {
  const users = await prisma.user.findMany({
    select: { subscriptionPlan: true, subscriptionStatus: true, moduleUsage: true },
  });

  const counts = new Map<string, { active: number; inactive: number }>();
  for (const mod of OPS_MODULES) {
    counts.set(mod, { active: 0, inactive: 0 });
  }
  counts.set("pro", { active: 0, inactive: 0 });
  counts.set("trial", { active: 0, inactive: 0 });

  for (const u of users) {
    const isActive = u.subscriptionStatus === "active" || u.subscriptionStatus === "trial";
    const planKey = u.subscriptionPlan === "plus" ? "pro" : u.subscriptionPlan;
    const bucket = counts.get(planKey) ?? { active: 0, inactive: 0 };
    if (isActive) bucket.active += 1;
    else bucket.inactive += 1;
    counts.set(planKey, bucket);
  }

  return [...counts.entries()].map(([module, c]) => ({
    module,
    active: c.active,
    inactive: c.inactive,
  }));
}

function getModuleHealth() {
  const feeds = [
    { module: "voice", label: "Voice / OpenAI", ok: Boolean(process.env.OPENAI_API_KEY) },
    { module: "dashboard", label: "Daily briefing", ok: Boolean(process.env.OPENAI_API_KEY) },
    { module: "money", label: "Money module", ok: true },
    { module: "career", label: "Career module", ok: true },
    { module: "settings", label: "Stripe billing", ok: Boolean(process.env.STRIPE_SECRET_KEY) },
  ];

  return feeds.map((f) => ({
    ...f,
    status: f.ok ? "healthy" : "degraded",
    usage7d: 0,
    avgLatencyMs: 0,
    errors7d: 0,
  }));
}

async function enrichModuleHealth(
  base: ReturnType<typeof getModuleHealth>
) {
  const start = daysAgo(7);
  const stats = await prisma.usageEvent.groupBy({
    by: ["module"],
    where: { createdAt: { gte: start } },
    _count: { _all: true },
    _avg: { durationMs: true },
  });
  const errors = await prisma.usageEvent.groupBy({
    by: ["module"],
    where: { createdAt: { gte: start }, statusCode: { gte: 400 } },
    _count: { _all: true },
  });
  const statMap = new Map(stats.map((s) => [s.module, s]));
  const errMap = new Map(errors.map((e) => [e.module, e._count._all]));

  return base.map((m) => {
    const s = statMap.get(m.module);
    const usage7d = s?._count._all ?? 0;
    const errors7d = errMap.get(m.module) ?? 0;
    return {
      ...m,
      usage7d,
      avgLatencyMs: Math.round(s?._avg.durationMs ?? 0),
      errors7d,
      status: m.ok && errors7d < 10 ? "healthy" : "degraded",
    };
  });
}

export async function getAdminDashboardSnapshot() {
  const now = new Date();
  const oneDayAgo = daysAgo(1);
  const sevenDaysAgo = daysAgo(7);
  const thirtyDaysAgo = daysAgo(30);
  const currentMonth = monthKey(now);

  const [
    totalUsers,
    proActive,
    trialActive,
    cancelled30d,
    usageEvents24h,
    marketingOptIn,
    voiceCaptures7d,
    tasksDone7d,
    aiUsageRows,
    allUsersGeo,
    recentUsers,
    channelRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { subscriptionPlan: "plus", subscriptionStatus: "active" } }),
    prisma.user.count({
      where: { subscriptionPlan: "trial", subscriptionStatus: { in: ["active", "trial"] } },
    }),
    prisma.user.count({
      where: {
        subscriptionStatus: { in: ["cancelled", "paused", "past_due"] },
        updatedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.usageEvent.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.user.count({ where: { marketingEmailConsent: true } }),
    prisma.voiceCapture.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.task.count({ where: { status: "DONE", completedAt: { gte: sevenDaysAgo } } }),
    prisma.aiUsageMonthly.findMany({ where: { monthKey: currentMonth } }),
    prisma.user.findMany({
      select: {
        id: true,
        signupCountry: true,
        signupRegion: true,
        signupCity: true,
        signupContinent: true,
        signupLatitude: true,
        signupLongitude: true,
        createdAt: true,
        birthYear: true,
        acquisitionChannel: true,
        marketingEmailConsent: true,
      },
    }),
    prisma.user.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 25,
      select: {
        id: true,
        email: true,
        name: true,
        birthYear: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        signupCountry: true,
        signupRegion: true,
        signupCity: true,
        signupContinent: true,
        acquisitionChannel: true,
        marketingEmailConsent: true,
        legalConsentVersion: true,
        stripeCustomerId: true,
        createdAt: true,
        lastSeenAt: true,
        updatedAt: true,
        _count: { select: { tasks: true, goals: true, voiceCaptures: true } },
      },
    }),
    prisma.user.groupBy({
      by: ["acquisitionChannel"],
      _count: { _all: true },
    }),
  ]);

  const [
    activityHeatmap,
    moduleActivityRanking,
    subscriptionsByModule,
    moduleHealth,
    signupsByDay,
  ] = await Promise.all([
    getActivityHeatmap(14),
    getModuleActivityRanking(30),
    getSubscriptionsByModule(),
    enrichModuleHealth(getModuleHealth()),
    (async () => {
      const rows: { day: string; count: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const start = daysAgo(i);
        const end = daysAgo(i - 1);
        const count = await prisma.user.count({
          where: { createdAt: { gte: start, lt: end } },
        });
        rows.push({ day: start.toISOString().slice(0, 10), count });
      }
      return rows;
    })(),
  ]);

  const mapPoints = allUsersGeo
    .map((u) => {
      const coords = resolveMapCoords(u);
      if (!coords) return null;
      return {
        id: u.id,
        lat: coords.lat,
        lng: coords.lng,
        country: u.signupCountry ?? "Unknown",
        region: u.signupRegion,
        city: u.signupCity,
        continent: u.signupContinent ?? countryToContinent(u.signupCountry),
        createdAt: u.createdAt.toISOString(),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  const cohorts = countBy(allUsersGeo, (u) => generationBucket(u.birthYear));
  const ageBuckets = countBy(allUsersGeo, (u) => ageBucket(u.birthYear));
  const continents = countBy(allUsersGeo, (u) => u.signupContinent ?? countryToContinent(u.signupCountry));
  const countries = countBy(allUsersGeo, (u) => u.signupCountry);
  const regions = allUsersGeo
    .filter((u) => u.signupRegion && u.signupCountry)
    .reduce(
      (acc, u) => {
        const key = `${u.signupCountry}|${u.signupRegion}`;
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
      },
      new Map<string, number>()
    );
  const cities = allUsersGeo
    .filter((u) => u.signupCity && u.signupCountry)
    .reduce(
      (acc, u) => {
        const key = `${u.signupCountry}|${u.signupRegion ?? ""}|${u.signupCity}`;
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
      },
      new Map<string, number>()
    );

  const topLocations = [...countries]
    .slice(0, 15)
    .map(({ value, count }) => {
      const sample = allUsersGeo.find((u) => u.signupCountry === value);
      return {
        country: value,
        region: sample?.signupRegion ?? "",
        city: sample?.signupCity ?? "",
        c: count,
      };
    });

  const churnByModule = [
    { module: "pro", cancellations: cancelled30d },
    { module: "trial", cancellations: await prisma.user.count({ where: { subscriptionPlan: "trial", subscriptionStatus: "cancelled", updatedAt: { gte: thirtyDaysAgo } } }) },
  ];

  const proRevenue = proActive * PRO_PRICE_CAD;
  const channelPerformance = {
    days: 90,
    topRevenueChannel: channelRows.sort((a, b) => b._count._all - a._count._all)[0]?.acquisitionChannel ?? null,
    channels: channelRows.map((r) => ({
      id: r.acquisitionChannel ?? "direct",
      platform: r.acquisitionChannel ?? "direct",
      handle: "—",
      url: null,
      signups: r._count._all,
      subscriptions: 0,
      payments: 0,
      churns: 0,
      revenueUsd: 0,
      conversionRate: totalUsers > 0 ? Math.round((r._count._all / totalUsers) * 1000) / 10 : 0,
    })),
  };

  return {
    generatedAt: now.toISOString(),
    priceLabel: PLAN_PRICE_LABEL,
    moduleLabels: MODULE_LABELS,
    kpis: {
      totalUsers,
      activeModuleSubscriptions: proActive + trialActive,
      annualSubscribers: 0,
      estimatedMrrUsd: Math.round(proActive * PRO_PRICE_CAD * 100) / 100,
      estimatedMrrCad: Math.round(proActive * PRO_PRICE_CAD * 100) / 100,
      usageEvents24h,
      churnEvents30d: cancelled30d,
      proActive,
      trialActive,
      signups7d: await prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      voiceCaptures7d,
      tasksDone7d,
      aiVoiceUnitsThisMonth: aiUsageRows.reduce((s, r) => s + r.voiceOrganizeUnits, 0),
      marketingOptInRate: totalUsers > 0 ? Math.round((marketingOptIn / totalUsers) * 1000) / 10 : 0,
    },
    subscriptionsByModule,
    moduleHealth,
    activityHeatmap,
    moduleActivityRanking,
    churnByModule,
    demographics: {
      cohorts: cohorts.map((c) => ({ cohort: c.value, c: c.count })),
      sex: [],
      gender: [],
      ageBuckets: ageBuckets.map((a) => ({ bucket: a.value, c: a.count })),
      topLocations,
      paymentMethods: [
        { payment_method: "stripe_card", c: await prisma.user.count({ where: { stripeCustomerId: { not: null } } }) },
        { payment_method: "trial_only", c: trialActive },
      ],
    },
    signupMap: {
      points: mapPoints,
      filters: {
        continents: continents.map((c) => ({ value: c.value, count: c.count })),
        countries: countries.map((c) => ({
          value: c.value,
          label: countryDisplayName(c.value),
          count: c.count,
        })),
        regions: [...regions.entries()].map(([key, count]) => {
          const [country, region] = key.split("|");
          return { value: region, country, count };
        }),
        cities: [...cities.entries()].map(([key, count]) => {
          const [country, region, city] = key.split("|");
          return { value: city, country, region: region || null, count };
        }),
      },
      locatedUsers: mapPoints.length,
      totalUsers,
    },
    channelPerformance,
    payments: {
      revenueUsd: Math.round(proRevenue * 100) / 100,
      revenueCad: Math.round(proRevenue * 100) / 100,
      transactions: proActive,
      avgTicketUsd: PRO_PRICE_CAD,
      byPlanTier: [
        { plan_tier: "pro", revenue: proRevenue, cnt: proActive },
        { plan_tier: "trial", revenue: 0, cnt: trialActive },
      ],
      byPaymentMethod: [{ payment_method: "stripe", revenue: proRevenue, cnt: proActive }],
      recent: recentUsers
        .filter((u) => u.subscriptionPlan === "plus")
        .slice(0, 10)
        .map((u) => ({
          user_id: u.id,
          amount_usd: PRO_PRICE_CAD,
          payment_method: "stripe",
          plan_tier: "pro",
          module: "pro",
          status: u.subscriptionStatus,
          created_at: u.createdAt.toISOString(),
        })),
    },
    signupsByDay,
    generationBreakdown: cohorts.map((c) => ({ generation: c.value, count: c.count })),
    topAiUsers: aiUsageRows
      .sort((a, b) => b.voiceOrganizeUnits - a.voiceOrganizeUnits)
      .slice(0, 10)
      .map((row) => ({
        userId: row.userId,
        voiceOrganizeUnits: row.voiceOrganizeUnits,
        totalCalls: row.briefingCalls + row.eveningCalls + row.weeklyCalls + row.voiceAiCalls,
      })),
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      cohort: generationBucket(u.birthYear),
      generation: generationBucket(u.birthYear),
      age: u.birthYear ? new Date().getFullYear() - u.birthYear : null,
      plan: u.subscriptionPlan,
      status: u.subscriptionStatus,
      city: u.signupCity,
      country: u.signupCountry,
      region: u.signupRegion,
      continent: u.signupContinent,
      acquisition_channel: u.acquisitionChannel,
      marketingOptIn: u.marketingEmailConsent,
      legalVersion: u.legalConsentVersion,
      hasStripe: Boolean(u.stripeCustomerId),
      tasks: u._count.tasks,
      goals: u._count.goals,
      voiceCaptures: u._count.voiceCaptures,
      active_modules: u.subscriptionPlan,
      createdAt: u.createdAt.toISOString(),
      last_seen_at: (u.lastSeenAt ?? u.updatedAt).toISOString(),
    })),
  };
}

export type AdminDashboardSnapshot = Awaited<ReturnType<typeof getAdminDashboardSnapshot>>;

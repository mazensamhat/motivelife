import { prisma } from "@forward/database";

export type HealthMetricInput = {
  source: string;
  metricType: string;
  value: number;
  unit: string;
  periodStart: string;
  periodEnd?: string | null;
  externalId?: string | null;
};

export type HealthSyncSummary = {
  steps: number | null;
  sleepMinutes: number | null;
  restingHr: number | null;
  activeMinutes: number | null;
  lastSyncedAt: string | null;
  sources: string[];
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function upsertHealthMetrics(userId: string, metrics: HealthMetricInput[]) {
  let count = 0;
  for (const m of metrics) {
    if (!Number.isFinite(m.value)) continue;
    const periodStart = new Date(m.periodStart);
    const externalId = m.externalId ?? `${m.metricType}-${periodStart.toISOString().slice(0, 10)}`;
    await prisma.healthMetric.upsert({
      where: {
        userId_source_metricType_periodStart_externalId: {
          userId,
          source: m.source,
          metricType: m.metricType,
          periodStart,
          externalId,
        },
      },
      create: {
        userId,
        source: m.source,
        metricType: m.metricType,
        value: m.value,
        unit: m.unit,
        periodStart,
        periodEnd: m.periodEnd ? new Date(m.periodEnd) : null,
        externalId,
      },
      update: {
        value: m.value,
        unit: m.unit,
        periodEnd: m.periodEnd ? new Date(m.periodEnd) : null,
      },
    });
    count += 1;
  }
  await rollupHealthMetricsToItems(userId);
  return count;
}

export async function rollupHealthMetricsToItems(userId: string) {
  const since = startOfToday();
  const today = await prisma.healthMetric.findMany({
    where: { userId, periodStart: { gte: since } },
  });

  const steps = today.find((m) => m.metricType === "steps")?.value;
  const sleepMinutes = today.find((m) => m.metricType === "sleep_minutes")?.value;
  const activeMinutes = today.find((m) => m.metricType === "active_minutes")?.value;

  const items = await prisma.healthItem.findMany({ where: { userId } });

  for (const item of items) {
    let next: number | null = null;
    if (item.type === "FITNESS" && steps != null && /step/i.test(item.title)) {
      next = steps;
    } else if (item.type === "FITNESS" && activeMinutes != null && /active|workout|exercise/i.test(item.title)) {
      next = activeMinutes;
    } else if (item.type === "SLEEP" && sleepMinutes != null) {
      next = Math.round((sleepMinutes / 60) * 10) / 10;
    }
    if (next != null && next !== item.currentValue) {
      await prisma.healthItem.update({
        where: { id: item.id },
        data: { currentValue: next },
      });
    }
  }

  if (steps != null && !items.some((i) => i.type === "FITNESS" && /step/i.test(i.title))) {
    await prisma.healthItem.create({
      data: {
        userId,
        type: "FITNESS",
        title: "Daily steps",
        targetValue: 10000,
        currentValue: steps,
        unit: "steps",
      },
    });
  }

  if (sleepMinutes != null && !items.some((i) => i.type === "SLEEP")) {
    await prisma.healthItem.create({
      data: {
        userId,
        type: "SLEEP",
        title: "Sleep",
        targetValue: 8,
        currentValue: Math.round((sleepMinutes / 60) * 10) / 10,
        unit: "hours",
      },
    });
  }
}

export async function getHealthSyncSummary(userId: string): Promise<HealthSyncSummary> {
  const since = startOfToday();
  const metrics = await prisma.healthMetric.findMany({
    where: { userId, periodStart: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const latest = (type: string) => metrics.find((m) => m.metricType === type)?.value ?? null;
  const last = metrics[0];

  return {
    steps: latest("steps"),
    sleepMinutes: latest("sleep_minutes"),
    restingHr: latest("resting_hr"),
    activeMinutes: latest("active_minutes"),
    lastSyncedAt: last?.createdAt.toISOString() ?? null,
    sources: [...new Set(metrics.map((m) => m.source))],
  };
}
